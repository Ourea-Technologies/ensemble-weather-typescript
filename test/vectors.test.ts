// SPDX-License-Identifier: BSD-2-Clause
// Runs every shared vector in spec/vectors (BEHAVIOR.md section 13) against a
// mock transport. The argument mapping below is the only per-language code.
// A vector this runner cannot run fails; nothing is skipped.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCATION_TYPES, OureaError, Ourea, isKnown, type ClientOptions } from '../src/index.js';
import { camelKey, camelize } from '../src/internal/camel.js';
import { resetDeprecationWarnings, type Clock } from '../src/internal/transport.js';

const VECTORS = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'vectors');

interface VectorRequest {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  query_string?: string;
  query_absent?: string[];
  headers?: Record<string, string>;
  headers_absent?: string[];
  headers_match?: Record<string, string>;
  url_prefix?: string;
}

interface VectorCall {
  operation: string;
  args: Record<string, unknown>;
  with_api_key?: string;
}

interface Vector {
  name: string;
  description: string;
  client: {
    api_key?: string;
    base_url?: string;
    max_retries?: number;
    cache?: boolean;
    send_key_on_open_routes?: boolean;
    env?: Record<string, string>;
  };
  call?: VectorCall;
  calls?: VectorCall[];
  expect_request?: VectorRequest | null;
  expect_requests?: VectorRequest[];
  responses: {
    status: number;
    headers?: Record<string, string>;
    body_file?: string;
    body?: string;
  }[];
  expect: {
    result?: Record<string, unknown>;
    results?: Record<string, unknown>[];
    error?: {
      category?: string;
      code?: string | null;
      status?: number;
      retry_after?: number;
      string_excludes?: string;
    };
    requests?: number;
    delays_s?: number[];
    items?: string[];
    warnings?: { contains: string }[];
  };
}

function vectorFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === 'bodies' ? [] : vectorFiles(full);
      return name.endsWith('.json') ? [full] : [];
    })
    .sort();
}

interface Sent {
  url: string;
  headers: Headers;
}

/** Calls one operation through the public API, with the vector's semantic args. */
async function invoke(client: Ourea, call: VectorCall): Promise<unknown> {
  const { iterate, location, state, name, slug, q, lat, lon, elevation_m, ...rest } = call.args;
  const options = camelize(rest) as Record<string, never>;
  const where =
    location !== undefined
      ? (location as string)
      : { state: state as string, slug: name as string };
  const point = {
    lat: lat as number,
    lon: lon as number,
    ...(elevation_m === undefined ? {} : { elevationM: elevation_m as number }),
  };
  switch (call.operation) {
    case 'getLocationForecast':
      return client.getForecast(where, options);
    case 'getPointForecast':
      return client.getPointForecast(point, options);
    case 'searchLocations':
      return client.searchLocations(q as string, options);
    case 'getCatalogLocation':
      return client.getCatalogLocation(slug as string, options);
    case 'getAttribution':
      return client.getAttribution(options);
    case 'listCatalogLocations': {
      const request = client.listCatalogLocations(options);
      if (iterate !== true) return request;
      const items: string[] = [];
      for await (const item of request) items.push(item.slug);
      return items;
    }
    default:
      throw new Error(`the vectors runner has no mapping for operation ${call.operation}`);
  }
}

const KNOWN_ENUMS: Readonly<Record<string, readonly string[]>> = {
  'location.type': LOCATION_TYPES,
};

/** Reads a vector path (`probabilities[0].window_start_hours`) from a result. */
function read(result: unknown, path: string): unknown {
  if (path === 'revalidated')
    return (result as { meta: { revalidated: boolean } }).meta.revalidated;
  let current: unknown = result;
  let segments = path.split('.');
  if (segments[0] === 'rate_limit') {
    current = (result as { meta: { rateLimit: unknown } }).meta.rateLimit;
    segments = segments.slice(1);
  }
  for (const segment of segments) {
    const m = /^([^[]+)((?:\[\d+\])*)$/.exec(segment);
    if (m === null) throw new Error(`bad path ${path}`);
    current = (current as Record<string, unknown> | undefined)?.[camelKey(m[1] ?? '')];
    for (const index of (m[2] ?? '').matchAll(/\[(\d+)\]/g)) {
      current = (current as unknown[] | undefined)?.[Number(index[1])];
    }
  }
  return current;
}

function checkResult(result: unknown, expected: Record<string, unknown>): void {
  for (const [path, want] of Object.entries(expected)) {
    const got = read(result, path);
    if (want === null) {
      expect(got ?? null, path).toBeNull();
    } else if (typeof want === 'object' && 'unknown' in want) {
      const raw = (want as { unknown: string }).unknown;
      expect(got, path).toBe(raw);
      const known = KNOWN_ENUMS[path];
      if (known === undefined) throw new Error(`no known-enum list mapped for ${path}`);
      expect(isKnown(known, raw), `${path} should be an unknown enum value`).toBe(false);
    } else {
      expect(got, path).toEqual(want);
    }
  }
}

function checkRequest(sent: Sent | undefined, want: VectorRequest, label: string): void {
  expect(sent, `${label} was not sent`).toBeDefined();
  if (sent === undefined) return;
  const url = new URL(sent.url);
  const rawQuery = sent.url.includes('?') ? sent.url.slice(sent.url.indexOf('?') + 1) : '';
  if (want.method !== undefined) expect('GET', `${label} method`).toBe(want.method);
  if (want.path !== undefined) expect(url.pathname, `${label} path`).toBe(want.path);
  if (want.url_prefix !== undefined)
    expect(sent.url.startsWith(want.url_prefix), `${label} url ${sent.url}`).toBe(true);
  if (want.query_string !== undefined)
    expect(rawQuery, `${label} query string`).toBe(want.query_string);
  for (const [k, v] of Object.entries(want.query ?? {}))
    expect(url.searchParams.get(k), `${label} query ${k}`).toBe(v);
  for (const k of want.query_absent ?? [])
    expect(url.searchParams.has(k), `${label} query ${k} absent`).toBe(false);
  for (const [k, v] of Object.entries(want.headers ?? {}))
    expect(sent.headers.get(k), `${label} header ${k}`).toBe(v);
  for (const k of want.headers_absent ?? [])
    expect(sent.headers.has(k), `${label} header ${k} absent`).toBe(false);
  for (const [k, re] of Object.entries(want.headers_match ?? {})) {
    expect(sent.headers.get(k) ?? '', `${label} header ${k}`).toMatch(new RegExp(re));
  }
}

const savedEnv = { key: process.env.OUREA_API_KEY, base: process.env.OUREA_BASE_URL };
afterEach(() => {
  for (const [name, value] of [
    ['OUREA_API_KEY', savedEnv.key],
    ['OUREA_BASE_URL', savedEnv.base],
  ] as const) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
  }
});

const files = vectorFiles(VECTORS);

describe('shared vectors', () => {
  it('finds all 43 vectors', () => {
    expect(files).toHaveLength(43);
  });

  for (const file of files) {
    const vector = JSON.parse(readFileSync(file, 'utf8')) as Vector;
    it(`${relative(VECTORS, file)}: ${vector.description}`, async () => {
      resetDeprecationWarnings();
      Reflect.deleteProperty(process.env, 'OUREA_API_KEY');
      Reflect.deleteProperty(process.env, 'OUREA_BASE_URL');
      Object.assign(process.env, vector.client.env ?? {});

      const sent: Sent[] = [];
      const responses = [...vector.responses];
      const delays: number[] = [];
      const warnings: string[] = [];
      let now = Date.parse('2026-11-15T00:00:00Z');
      const clock: Clock = {
        now: () => now,
        random: () => 1.0,
        sleep: (ms) => {
          delays.push(ms / 1000);
          now += ms;
          return Promise.resolve();
        },
      };
      const fetchMock = (input: string, init: RequestInit): Promise<Response> => {
        sent.push({ url: input, headers: new Headers(init.headers) });
        const next = responses.shift();
        if (next === undefined)
          return Promise.reject(new Error(`unexpected request #${String(sent.length)}: ${input}`));
        const body =
          next.body_file !== undefined
            ? readFileSync(join(VECTORS, next.body_file), 'utf8')
            : (next.body ?? null);
        const nullBody = [204, 301, 302, 304, 307, 308].includes(next.status);
        return Promise.resolve(
          new Response(nullBody ? null : body, {
            status: next.status,
            headers: next.headers ?? {},
          }),
        );
      };

      const options: ClientOptions = {
        fetch: fetchMock,
        clock,
        logger: { warn: (m) => warnings.push(m) },
        ...(vector.client.api_key === undefined ? {} : { apiKey: vector.client.api_key }),
        ...(vector.client.base_url === undefined ? {} : { baseUrl: vector.client.base_url }),
        ...(vector.client.max_retries === undefined
          ? {}
          : { maxRetries: vector.client.max_retries }),
        ...(vector.client.cache === undefined ? {} : { cache: vector.client.cache }),
        ...(vector.client.send_key_on_open_routes === undefined
          ? {}
          : { sendKeyOnOpenRoutes: vector.client.send_key_on_open_routes }),
      };
      const client = new Ourea(options);

      const calls = vector.calls ?? (vector.call === undefined ? [] : [vector.call]);
      const results: unknown[] = [];
      let error: unknown;
      for (const call of calls) {
        const target =
          call.with_api_key === undefined
            ? client
            : client.withOptions({ apiKey: call.with_api_key });
        try {
          results.push(await invoke(target, call));
        } catch (e) {
          error = e;
          break;
        }
      }

      const want = vector.expect;
      if (want.error === undefined) {
        expect(error, 'no error was expected').toBeUndefined();
      } else {
        expect(error, 'an error was expected').toBeInstanceOf(OureaError);
        const e = error as OureaError & { code?: string; status?: number; retryAfter?: number };
        if (want.error.category !== undefined) expect(e.category).toBe(want.error.category);
        if (want.error.code !== undefined) expect(e.code ?? null).toBe(want.error.code);
        if (want.error.status !== undefined) expect(e.status).toBe(want.error.status);
        if (want.error.retry_after !== undefined) expect(e.retryAfter).toBe(want.error.retry_after);
        if (want.error.string_excludes !== undefined) {
          for (const text of [e.message, String(e), inspect(e), JSON.stringify(e), e.stack ?? '']) {
            expect(text).not.toContain(want.error.string_excludes);
          }
        }
      }

      if (vector.expect_request === null) expect(sent).toHaveLength(0);
      else if (vector.expect_request !== undefined)
        checkRequest(sent[0], vector.expect_request, 'request');
      for (const [i, req] of (vector.expect_requests ?? []).entries()) {
        checkRequest(sent[i], req, `request ${String(i + 1)}`);
      }
      if (want.requests !== undefined) expect(sent).toHaveLength(want.requests);
      if (want.result !== undefined) checkResult(results[0], want.result);
      for (const [i, r] of (want.results ?? []).entries()) checkResult(results[i], r);
      if (want.items !== undefined) expect(results[0]).toEqual(want.items);
      if (want.delays_s !== undefined) {
        expect(delays).toHaveLength(want.delays_s.length);
        want.delays_s.forEach((d, i) => {
          expect(delays[i]).toBeCloseTo(d, 9);
        });
      }
      if (want.warnings !== undefined) {
        expect(warnings).toHaveLength(want.warnings.length);
        want.warnings.forEach((w, i) => {
          expect(warnings[i]).toContain(w.contains);
        });
      }
      expect(responses, 'every scripted response was consumed').toHaveLength(0);
    });
  }
});
