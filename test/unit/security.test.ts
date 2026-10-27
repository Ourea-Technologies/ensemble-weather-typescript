// SPDX-License-Identifier: BSD-2-Clause
// The SDK-side security guarantees of SDK-STANDARD.md "Security".

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ConnectionError, OureaError, type ClientOptions } from '../../src/index.js';
import { MAX_BODY_BYTES } from '../../src/internal/transport.js';
import { body, harness, SPEC } from '../helpers.js';

const KEY = 'ow_live_secret_0123456789';
const SRC = join(SPEC, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('the API key never leaks', () => {
  it('is not in toString, inspect or JSON of the client', () => {
    const { client } = harness([], { apiKey: KEY });
    for (const text of [
      String(client),
      inspect(client, { showHidden: true, depth: 5 }),
      JSON.stringify(client),
    ]) {
      expect(text).not.toContain(KEY);
    }
    expect(client.hasApiKey).toBe(true);
  });

  it('is not in an error, even when the server echoes it', async () => {
    const { client } = harness(
      [
        {
          status: 401,
          body: JSON.stringify({ error: 'INVALID_API_KEY', message: `bad key ${KEY}` }),
        },
      ],
      {
        apiKey: KEY,
      },
    );
    const error = await client.getForecast('or/mt-hood-meadows').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OureaError);
    const e = error as Error;
    for (const text of [e.message, String(e), inspect(e), JSON.stringify(e), e.stack ?? '']) {
      expect(text).not.toContain(KEY);
    }
  });

  it('is not in a connection error built from the transport failure', async () => {
    const { client } = harness([{ error: new TypeError(`fetch failed for ${KEY}`) }], {
      apiKey: KEY,
      maxRetries: 0,
    });
    const error = (await client.getForecast('or/x').catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.message).not.toContain(KEY);
  });

  it('is not in any log line', async () => {
    const h = harness(
      [
        { status: 301, headers: { Location: '/api/v1/locations/or/mt-hood-meadows' } },
        {
          body: body('forecast-metric'),
          headers: {
            Deprecation: '@1',
            Link: '<https://docs.oureawx.com/changelog>; rel="deprecation"',
          },
        },
      ],
      { apiKey: KEY },
    );
    await h.client.getForecast('oregon/mt-hood-meadows');
    expect(h.warnings.length + h.debug.length).toBeGreaterThan(0);
    for (const line of [...h.warnings, ...h.debug]) expect(line).not.toContain(KEY);
  });

  it('is never sent as a query parameter', async () => {
    const h = harness([{ body: body('forecast-metric') }], { apiKey: KEY });
    await h.client.getForecast('or/mt-hood-meadows');
    expect(h.sent[0]?.url).not.toContain(KEY);
    expect(h.sent[0]?.headers.get('X-API-Key')).toBe(KEY);
  });
});

describe('redirects', () => {
  it('drops the key on a redirect to another host, and does not restore it', async () => {
    const h = harness(
      [
        { status: 307, headers: { Location: 'https://other.example.test/a' } },
        {
          status: 302,
          headers: { Location: 'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows' },
        },
        { body: body('forecast-metric') },
      ],
      { apiKey: KEY },
    );
    await h.client.getForecast('or/mt-hood-meadows');
    expect(h.sent.map((s) => s.headers.get('X-API-Key'))).toEqual([KEY, null, null]);
    expect(h.sent[0]?.init.redirect).toBe('manual');
  });

  it('stops after 5 redirects', async () => {
    const loop = Array.from({ length: 6 }, () => ({
      status: 302,
      headers: { Location: '/api/v1/x' },
    }));
    const h = harness(loop, { maxRetries: 0 });
    await expect(h.client.getForecast('or/x')).rejects.toBeInstanceOf(ConnectionError);
    expect(h.sent).toHaveLength(6);
  });

  it('never sends a key blindly through an opaque browser redirect', async () => {
    const opaque = {
      type: 'opaqueredirect',
      status: 0,
      headers: new Headers(),
      body: null,
    } as unknown as Response;
    const options: ClientOptions = {
      apiKey: KEY,
      maxRetries: 0,
      fetch: () => Promise.resolve(opaque),
    };
    const { client } = harness([], options);
    await expect(client.getForecast('or/x')).rejects.toBeInstanceOf(ConnectionError);
  });
});

describe('TLS', () => {
  it('has no option to disable certificate verification', () => {
    const offending =
      /rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED|insecure|skipTls|verify(?:Ssl|Tls)/i;
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) expect(readFileSync(file, 'utf8')).not.toMatch(offending);
  });

  it('does not retry a certificate verification failure', async () => {
    const tlsFailure = new TypeError('fetch failed', {
      cause: Object.assign(new Error('unable to verify the first certificate'), {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      }),
    });
    const h = harness([{ error: tlsFailure }]);
    await expect(h.client.getForecast('or/x')).rejects.toBeInstanceOf(ConnectionError);
    expect(h.sent).toHaveLength(1);
  });
});

describe('response bodies are bounded at 64 MiB', () => {
  it('refuses a declared Content-Length over the bound without reading it', async () => {
    const h = harness([{ body: '{}', headers: { 'Content-Length': String(MAX_BODY_BYTES + 1) } }]);
    await expect(h.client.getAttribution()).rejects.toThrow(/64 MiB/);
  });

  it('stops reading a streamed body once it passes the bound', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(chunk);
      },
    });
    const h = harness([{ body: stream }]);
    await expect(h.client.getAttribution()).rejects.toThrow(/64 MiB/);
    expect(pulled).toBeLessThanOrEqual(70);
  });
});

describe('JSON parsing', () => {
  it('builds plain data only: no prototypes from the body, no code evaluated', async () => {
    const h = harness([{ body: '{"__proto__": {"polluted": true}, "providers": []}' }]);
    const result = await h.client.getAttribution();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
