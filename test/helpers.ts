// SPDX-License-Identifier: BSD-2-Clause
// A scripted mock transport and a fake clock for the unit tests.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ourea, type ClientOptions, type FetchLike } from '../src/index.js';
import type { Clock } from '../src/internal/transport.js';

export const SPEC = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec');

/** A vector body, by name (`forecast-metric`). */
export function body(name: string): string {
  return readFileSync(join(SPEC, 'vectors', 'bodies', `${name}.json`), 'utf8');
}

export interface Scripted {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly body?: string | ReadableStream<Uint8Array> | null;
  /** Throw this instead of answering (a connection failure). */
  readonly error?: Error;
}

export interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly init: RequestInit;
}

export interface Harness {
  readonly client: Ourea;
  readonly sent: SentRequest[];
  readonly delays: number[];
  readonly warnings: string[];
  readonly debug: string[];
  readonly fetch: FetchLike;
}

/** A client whose transport answers from `script`, in order. */
export function harness(script: Scripted[], options: ClientOptions = {}): Harness {
  const queue = [...script];
  const sent: SentRequest[] = [];
  const delays: number[] = [];
  const warnings: string[] = [];
  const debug: string[] = [];
  let now = Date.parse('2026-11-15T00:00:00Z');
  const clock: Clock = {
    now: () => now,
    random: () => 1,
    sleep: (ms, signal) => {
      delays.push(ms / 1000);
      now += ms;
      if (signal?.aborted === true) return Promise.reject(signal.reason as Error);
      return Promise.resolve();
    },
  };
  const fetch: FetchLike = (url, init) => {
    sent.push({ url, headers: new Headers(init.headers), init });
    const next = queue.shift();
    if (next === undefined) return Promise.reject(new Error(`unexpected request ${url}`));
    if (next.error !== undefined) return Promise.reject(next.error);
    const status = next.status ?? 200;
    const nullBody = [204, 301, 302, 304, 307, 308].includes(status);
    return Promise.resolve(
      new Response(nullBody ? null : (next.body ?? '{}'), {
        status,
        headers: { 'Content-Type': 'application/json', ...next.headers },
      }),
    );
  };
  const client = new Ourea({
    apiKey: null,
    fetch,
    clock,
    logger: { warn: (m) => warnings.push(m), debug: (m) => debug.push(m) },
    ...options,
  });
  return { client, sent, delays, warnings, debug, fetch };
}

/** The raw query string of a sent request. */
export function queryOf(request: SentRequest | undefined): string {
  const url = request?.url ?? '';
  return url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
}
