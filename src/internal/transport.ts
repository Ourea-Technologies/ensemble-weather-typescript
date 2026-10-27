// SPDX-License-Identifier: BSD-2-Clause
// One GET, end to end: credentials (section 3.2), redirects (3.3), errors (8),
// retries (9), the ETag cache (10) and deprecation notices (11).

import type { CacheEntry, CacheStore } from '../cache.js';
import { apiErrorFrom, ConnectionError, OureaError, type ApiError } from '../errors.js';
import type { DeprecationNotice, RateLimit, ResponseMeta } from '../response.js';
import { sha256Hex } from './sha256.js';

/** The subset of `fetch` the SDK uses. The global `fetch` satisfies it. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Where the SDK sends warnings (deprecations) and debug notes. */
export interface Logger {
  warn(message: string): void;
  debug?(message: string): void;
}

/** @internal Time and randomness, injectable so tests never sleep. */
export interface Clock {
  now(): number;
  sleep(ms: number, signal: AbortSignal | undefined): Promise<void>;
  random(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(abortReason(signal));
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(abortReason(signal));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
};

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function abortReason(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason;
  return reason instanceof Error
    ? reason
    : new DOMException('This operation was aborted', 'AbortError');
}

/** @internal Settings the transport needs from the client. */
export interface TransportConfig {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly sendKeyOnOpenRoutes: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly cache: CacheStore | undefined;
  readonly fetch: FetchLike;
  readonly userAgent: string | undefined;
  readonly logger: Logger;
  readonly clock: Clock;
}

/** @internal One request. */
export interface RequestSpec {
  /** The operationId, for deprecation notices. */
  readonly operation: string;
  /** The path after the base URL, already percent-encoded. */
  readonly path: string;
  /** The canonical query string, without `?`. */
  readonly query: string;
  /** An open route (`security: []`): sent without the key unless configured otherwise. */
  readonly open: boolean;
  readonly signal: AbortSignal | undefined;
}

/** @internal A parsed response. */
export interface RawResult {
  readonly data: unknown;
  readonly meta: ResponseMeta;
  readonly lastRateLimit: RateLimit | undefined;
}

/** A body over this many bytes is an error, never an out-of-memory. */
export const MAX_BODY_BYTES = 64 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_RETRY_AFTER_S = 60;
const RETRYABLE_STATUS: ReadonlySet<number> = new Set([429, 502, 503, 504]);
const REDIRECT_STATUS: ReadonlySet<number> = new Set([301, 302, 307, 308]);
// Deprecation notices are once per operation per process (BEHAVIOR.md section 11).
const warnedOperations = new Set<string>();

/** @internal For tests: forget which operations already warned. */
export function resetDeprecationWarnings(): void {
  warnedOperations.clear();
}

class AttemptTimeout extends Error {}

export class Transport {
  readonly #config: TransportConfig;
  readonly #origin: string;

  constructor(config: TransportConfig) {
    this.#config = config;
    this.#origin = new URL(config.baseUrl).origin;
  }

  async get(spec: RequestSpec): Promise<RawResult> {
    const { cache, clock, maxRetries } = this.#config;
    const url = `${this.#config.baseUrl}${spec.path}${spec.query === '' ? '' : `?${spec.query}`}`;
    const key = spec.open && !this.#config.sendKeyOnOpenRoutes ? undefined : this.#config.apiKey;
    const cacheKey = `${url}#${key === undefined ? 'anonymous' : sha256Hex(key)}`;

    const cached = cache === undefined ? undefined : await cache.get(cacheKey);
    if (
      cached !== undefined &&
      cached.maxAge > 0 &&
      clock.now() - cached.storedAt < cached.maxAge * 1000
    ) {
      return this.#fromCache(cached, url, 200, new Headers(), false);
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.#config.userAgent !== undefined) headers['User-Agent'] = this.#config.userAgent;
    if (cached?.etag !== undefined) headers['If-None-Match'] = cached.etag;

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      let body: string;
      try {
        ({ response, body } = await this.#attempt(url, headers, key, spec.signal));
      } catch (error) {
        if (
          error instanceof ConnectionError &&
          isRetryableConnectionError(error) &&
          attempt < maxRetries
        ) {
          await clock.sleep(backoffMs(attempt + 1, clock), spec.signal);
          continue;
        }
        throw error;
      }

      const status = response.status;
      if (status === 304 && cached !== undefined) {
        this.#noteDeprecation(spec.operation, response.headers);
        const etag = response.headers.get('ETag') ?? cached.etag;
        const maxAge = parseCacheControl(response.headers).maxAge;
        if (cache !== undefined) {
          await cache.set(cacheKey, { etag, body: cached.body, storedAt: clock.now(), maxAge });
        }
        return this.#fromCache({ ...cached, etag }, url, 304, response.headers, true);
      }

      if (status >= 200 && status < 300) {
        this.#noteDeprecation(spec.operation, response.headers);
        const data = parseJson(body, status, response.headers);
        const control = parseCacheControl(response.headers);
        const etag = response.headers.get('ETag') ?? undefined;
        if (cache !== undefined) {
          if (!control.noStore && (etag !== undefined || control.maxAge > 0)) {
            await cache.set(cacheKey, {
              etag,
              body,
              storedAt: clock.now(),
              maxAge: control.maxAge,
            });
          } else if (cached !== undefined) {
            await cache.delete(cacheKey);
          }
        }
        return {
          data,
          meta: metaFrom(response, url, false, etag),
          lastRateLimit: rateLimitFrom(response.headers),
        };
      }

      const error = this.#errorFrom(response, body);
      if (RETRYABLE_STATUS.has(status) && attempt < maxRetries) {
        const retryAfter = status === 429 || status === 503 ? error.retryAfter : undefined;
        if (retryAfter !== undefined && retryAfter > MAX_RETRY_AFTER_S) throw error;
        const delay = retryAfter === undefined ? backoffMs(attempt + 1, clock) : retryAfter * 1000;
        await clock.sleep(delay, spec.signal);
        continue;
      }
      throw error;
    }
  }

  #fromCache(
    entry: CacheEntry,
    url: string,
    status: number,
    headers: Headers,
    revalidated: boolean,
  ): RawResult {
    const rateLimit = rateLimitFrom(headers);
    return {
      data: parseJson(entry.body, 200, headers),
      meta: {
        status,
        url,
        requestId: headers.get('X-Request-Id') ?? undefined,
        rateLimit,
        revalidated,
        etag: entry.etag,
        deprecation: deprecationFrom(headers),
      },
      lastRateLimit: rateLimit,
    };
  }

  /** One attempt: the request plus any redirects, and the body read, under the per-attempt timeout. */
  async #attempt(
    url: string,
    headers: Readonly<Record<string, string>>,
    key: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<{ response: Response; body: string }> {
    const controller = new AbortController();
    const onAbort = (): void => {
      controller.abort(abortReason(signal));
    };
    if (signal?.aborted === true) throw abortReason(signal);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      controller.abort(new AttemptTimeout());
    }, this.#config.timeoutMs);
    try {
      const response = await this.#followRedirects(url, headers, key, controller.signal);
      const body = await readBody(response);
      return { response, body };
    } catch (error) {
      if (isAborted(signal)) throw abortReason(signal);
      if (controller.signal.reason instanceof AttemptTimeout) {
        throw new ConnectionError(
          `No response within ${String(this.#config.timeoutMs)} ms (per-attempt timeout).`,
        );
      }
      if (error instanceof OureaError) throw error;
      throw new ConnectionError(
        `The request failed before a response arrived: ${describe(error, key)}`,
        {
          cause: error,
        },
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async #followRedirects(
    url: string,
    baseHeaders: Readonly<Record<string, string>>,
    key: string | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    let current = url;
    let sendKey = key;
    for (let hop = 0; ; hop++) {
      const headers = { ...baseHeaders };
      if (sendKey !== undefined) headers['X-API-Key'] = sendKey;
      const response = await this.#config.fetch(current, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal,
        credentials: 'omit',
      });
      if (response.type === 'opaqueredirect') {
        // Browsers hide the Location of a manual redirect, so we cannot check
        // its host. Without a key nothing can leak: let the browser follow it.
        if (sendKey !== undefined) {
          throw new ConnectionError(
            'The API redirected, and this runtime hides where to; the SDK will not send the API key blindly. ' +
              'Pass the location as a two-letter state code and slug so no redirect is needed.',
          );
        }
        return this.#config.fetch(current, {
          method: 'GET',
          headers,
          redirect: 'follow',
          signal,
          credentials: 'omit',
        });
      }
      const location = response.headers.get('Location');
      if (!REDIRECT_STATUS.has(response.status) || location === null) return response;
      await response.body?.cancel();
      if (hop >= MAX_REDIRECTS) {
        throw new ConnectionError(`Too many redirects (more than ${String(MAX_REDIRECTS)}).`);
      }
      const next = new URL(location, current);
      if (next.origin !== this.#origin) sendKey = undefined;
      if (response.status === 301 && current === url) {
        this.#config.logger.debug?.(`ensemble-weather: followed a 301 from ${url} to ${next.href}`);
      }
      current = next.href;
    }
  }

  #errorFrom(response: Response, body: string): ApiError {
    let code: string | undefined;
    let message = body.slice(0, 500).trim();
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'error' in parsed &&
        typeof parsed.error === 'string'
      ) {
        code = parsed.error;
        message = 'message' in parsed && typeof parsed.message === 'string' ? parsed.message : '';
      }
    } catch {
      // Not JSON: classify by status.
    }
    if (message === '') message = response.statusText || 'no message';
    return apiErrorFrom(
      response.status,
      code,
      redact(message, this.#config.apiKey),
      response.headers.get('X-Request-Id') ?? undefined,
      parseRetryAfter(response.headers.get('Retry-After'), this.#config.clock.now()),
    );
  }

  #noteDeprecation(operation: string, headers: Headers): void {
    const notice = deprecationFrom(headers);
    if (notice === undefined || warnedOperations.has(operation)) return;
    warnedOperations.add(operation);
    const parts = [`ensemble-weather: ${operation} is deprecated`];
    if (notice.deprecation !== undefined) parts.push(`(Deprecation: ${notice.deprecation})`);
    if (notice.sunset !== undefined) parts.push(`and will be removed (Sunset: ${notice.sunset})`);
    let text = parts.join(' ');
    if (notice.link !== undefined) text += `. See ${notice.link}`;
    this.#config.logger.warn(text);
  }
}

async function readBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

function tooLarge(): OureaError {
  return new OureaError(
    'unknown',
    `The response body is over ${String(MAX_BODY_BYTES / 1024 / 1024)} MiB; refusing to read it.`,
  );
}

function parseJson(body: string, status: number, headers: Headers): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw apiErrorFrom(
      status,
      undefined,
      'the response body is not valid JSON',
      headers.get('X-Request-Id') ?? undefined,
      undefined,
    );
  }
}

function isRetryableConnectionError(error: ConnectionError): boolean {
  // A TLS verification failure will fail the same way again.
  const cause: unknown = error.cause;
  const code = typeof cause === 'object' && cause !== null ? nestedCode(cause) : undefined;
  return code === undefined || !/CERT|SIGNATURE|SELF_SIGNED|ALTNAME|TLS/.test(code);
}

function nestedCode(error: object): string | undefined {
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('cause' in error && typeof error.cause === 'object' && error.cause !== null)
    return nestedCode(error.cause);
  return undefined;
}

function backoffMs(retry: number, clock: Clock): number {
  return clock.random() * Math.min(8000, 500 * 2 ** (retry - 1));
}

function describe(error: unknown, key: string | undefined): string {
  const text = error instanceof Error ? error.message : String(error);
  return redact(text, key);
}

function redact(text: string, key: string | undefined): string {
  return key === undefined || key === '' ? text : text.split(key).join('[redacted]');
}

/** `Retry-After` as seconds: delta-seconds or an HTTP-date. */
export function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - nowMs) / 1000));
}

function parseCacheControl(headers: Headers): { maxAge: number; noStore: boolean } {
  const value = (headers.get('Cache-Control') ?? '').toLowerCase();
  const directives = value.split(',').map((d) => d.trim());
  const noStore = directives.includes('no-store');
  const noCache = directives.includes('no-cache');
  const maxAgeDirective = directives.find((d) => d.startsWith('max-age='));
  const maxAge =
    noCache || maxAgeDirective === undefined ? 0 : Number(maxAgeDirective.slice(8)) || 0;
  return { maxAge, noStore };
}

function intHeader(headers: Headers, name: string): number | undefined {
  const v = headers.get(name);
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function rateLimitFrom(headers: Headers): RateLimit | undefined {
  const limit = intHeader(headers, 'RateLimit-Limit');
  const remaining = intHeader(headers, 'RateLimit-Remaining');
  const reset = intHeader(headers, 'RateLimit-Reset');
  const policy = headers.get('RateLimit-Policy') ?? undefined;
  if (
    limit === undefined &&
    remaining === undefined &&
    reset === undefined &&
    policy === undefined
  ) {
    return undefined;
  }
  return { limit, remaining, reset, policy };
}

function deprecationFrom(headers: Headers): DeprecationNotice | undefined {
  const deprecation = headers.get('Deprecation') ?? undefined;
  const sunset = headers.get('Sunset') ?? undefined;
  if (deprecation === undefined && sunset === undefined) return undefined;
  const linkHeader = headers.get('Link') ?? '';
  const match = /<([^>]+)>\s*;[^,]*rel="?deprecation"?/i.exec(linkHeader);
  return { deprecation, sunset, link: match?.[1] };
}

function metaFrom(
  response: Response,
  url: string,
  revalidated: boolean,
  etag: string | undefined,
): ResponseMeta {
  return {
    status: response.status,
    url,
    requestId: response.headers.get('X-Request-Id') ?? undefined,
    rateLimit: rateLimitFrom(response.headers),
    revalidated,
    etag,
    deprecation: deprecationFrom(response.headers),
  };
}
