// SPDX-License-Identifier: BSD-2-Clause
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  atLeast,
  ConnectionError,
  inches,
  MemoryCache,
  Ourea,
  RateLimitError,
  UnavailableError,
  UsageError,
  VERSION,
  windowTotal,
} from '../../src/index.js';
import { sha256Hex } from '../../src/internal/sha256.js';
import { parseRetryAfter } from '../../src/internal/transport.js';
import { body, harness, queryOf, SPEC } from '../helpers.js';

const saved = process.env.OUREA_API_KEY;
afterEach(() => {
  if (saved === undefined) Reflect.deleteProperty(process.env, 'OUREA_API_KEY');
  else process.env.OUREA_API_KEY = saved;
});

describe('configuration', () => {
  it('VERSION matches package.json', () => {
    const pkg = JSON.parse(readFileSync(join(SPEC, '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });

  it('sends the SDK User-Agent with the runtime, plus the app token', async () => {
    const h = harness([{ body: body('attribution') }], { userAgent: 'my-app/2.1' });
    await h.client.getAttribution();
    expect(h.sent[0]?.headers.get('User-Agent')).toMatch(
      /^ensemble-weather-typescript\/0\.1\.0 \(Node\.js\/\d+\.\d+\.\d+\) my-app\/2\.1$/,
    );
  });

  it('apiKey: null stays anonymous whatever the environment says', async () => {
    process.env.OUREA_API_KEY = 'ow_env';
    const h = harness([{ body: body('forecast-metric') }], { apiKey: null });
    await h.client.getForecast('or/mt-hood-meadows');
    expect(h.sent[0]?.headers.has('X-API-Key')).toBe(false);
    expect(h.client.hasApiKey).toBe(false);
  });

  it('validates its options', () => {
    expect(() => new Ourea({ baseUrl: 'ftp://x' })).toThrow(UsageError);
    expect(() => new Ourea({ maxRetries: -1 })).toThrow(UsageError);
    expect(() => new Ourea({ timeoutMs: 0 })).toThrow(UsageError);
    expect(() => new Ourea({ units: 'nautical' as never })).toThrow(UsageError);
  });

  it('sends the client units on every route that takes units, and only there', async () => {
    const h = harness(
      [
        { body: body('forecast-imperial') },
        { body: '{}' },
        { body: body('search') },
        { body: '{}' },
      ],
      { units: 'imperial' },
    );
    await h.client.getForecast('or/mt-hood-meadows');
    await h.client.getNearby('or/mt-hood-meadows');
    await h.client.searchLocations('hood');
    await h.client.getForecast('or/mt-hood-meadows', { units: 'metric' }).catch(() => undefined);
    expect(h.sent.map(queryOf)).toEqual(['units=imperial', 'units=imperial', 'q=hood', '']);
  });

  it('withOptions shares the cache but keeps keys apart', async () => {
    const cache = new MemoryCache();
    const h = harness(
      [
        { body: body('attribution'), headers: { ETag: '"a"' } },
        { status: 304, headers: { ETag: '"a"' } },
      ],
      { cache },
    );
    await h.client.getAttribution();
    const imperial = h.client.withOptions({ units: 'imperial' });
    const result = await imperial.getAttribution();
    expect(result.meta.revalidated).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('never prints the key', () => {
    expect(String(new Ourea({ apiKey: 'ow_x' }))).toBe(
      'Ourea(https://api.oureawx.com, with API key)',
    );
  });
});

describe('locations', () => {
  it('splits state/slug, lowercases a two-letter state, encodes each segment', async () => {
    const h = harness([{ body: '{}' }, { body: '{}' }, { body: '{}' }]);
    await h.client.getAlerts('CO/vail');
    await h.client.getAlerts({ state: 'New York', slug: 'a/b' });
    await h.client.getCurrent({ state: 'Or', slug: 'x' });
    expect(h.sent.map((s) => new URL(s.url).pathname)).toEqual([
      '/api/v1/locations/co/vail/alerts',
      '/api/v1/locations/New%20York/a%2Fb/alerts',
      '/api/v1/locations/or/x/current',
    ]);
  });

  it('refuses a malformed location before sending', async () => {
    const h = harness([]);
    for (const bad of ['or', 'or/a/b', '/x', 'or/']) {
      await expect(h.client.getForecast(bad)).rejects.toBeInstanceOf(UsageError);
    }
    await expect(h.client.getForecast({ state: '', slug: 'x' })).rejects.toBeInstanceOf(UsageError);
    expect(h.sent).toHaveLength(0);
  });
});

describe('every operation builds its canonical request', () => {
  it.each([
    [
      'getPointForecast',
      (c: Ourea) =>
        c.getPointForecast({ lat: 45.3311, lon: -121.6649 }, { maxHours: 48, members: true }),
      '/api/v1/forecast',
      'lat=45.3311&lon=-121.6649&max_hours=48&members=true',
    ],
    [
      'getCurrentAt',
      (c: Ourea) =>
        c.getCurrentAt(
          { lat: 45.33, lon: -121.71, elevationM: 1829 },
          { include: ['nowcast_hours'] },
        ),
      '/api/v1/current',
      'elevation_m=1829&include=nowcast_hours&lat=45.33&lon=-121.71',
    ],
    [
      'getAlertsAt',
      (c: Ourea) => c.getAlertsAt({ lat: 45.33, lon: -121.71 }),
      '/api/v1/alerts',
      'lat=45.33&lon=-121.71',
    ],
    [
      'getNearby',
      (c: Ourea) => c.getNearby('or/x', { limit: 3, radiusKm: 25 }),
      '/api/v1/locations/or/x/nearby',
      'radius_km=25',
    ],
    [
      'getNearbyAt',
      (c: Ourea) => c.getNearbyAt({ lat: 1, lon: 2 }, { limit: 5 }),
      '/api/v1/nearby',
      'lat=1&limit=5&lon=2',
    ],
    [
      'searchLocations',
      (c: Ourea) => c.searchLocations('mt hood', { state: 'or', limit: 20 }),
      '/api/v1/search/locations',
      'q=mt%20hood&state=or',
    ],
    [
      'getCatalogLocation',
      (c: Ourea) =>
        c.getCatalogLocation('mt-hood-meadows', { include: ['content', 'ads'], locale: 'en' }),
      '/api/v1/catalog/locations/mt-hood-meadows',
      'include=content%2Cads',
    ],
    [
      'getCatalogStation',
      (c: Ourea) => c.getCatalogStation('s1', { locale: 'es' }),
      '/api/v1/catalog/stations/s1',
      'locale=es',
    ],
    ['getRuns', (c: Ourea) => c.getRuns({ limit: 10 }), '/api/v1/runs', ''],
    [
      'getStormReports',
      (c: Ourea) => c.getStormReports({ limit: 5 }),
      '/api/v1/storm-reports',
      'limit=5',
    ],
    ['getStormReport', (c: Ourea) => c.getStormReport(42), '/api/v1/storm-reports/42', ''],
    [
      'getForecast',
      (c: Ourea) =>
        c.getForecast('or/x', {
          elevations: ['base', 'summit'],
          feelsLike: ['nws'],
          diagnostics: ['provenance'],
          run: new Date('2026-11-15T00:00:00Z'),
        }),
      '/api/v1/locations/or/x',
      'diagnostics=provenance&elevations=base%2Csummit&run=2026-11-15T00%3A00%3A00Z',
    ],
  ] as const)('%s', async (_name, call, path, query) => {
    const h = harness([{ body: '{}' }]);
    await call(h.client);
    expect(new URL(h.sent[0]?.url ?? '').pathname).toBe(path);
    expect(queryOf(h.sent[0])).toBe(query);
  });

  it('refuses a non-integer storm report id', async () => {
    await expect(harness([]).client.getStormReport(1.5)).rejects.toBeInstanceOf(UsageError);
  });

  it('lists state locations and walks their cursor', async () => {
    const page = (slug: string, next?: string): string =>
      JSON.stringify({
        state: 'or',
        count: 1,
        locations: [{ slug }],
        ...(next ? { next_cursor: next } : {}),
      });
    const h = harness([{ body: page('a', 'b') }, { body: page('b') }, { body: page('a', 'b') }]);
    const slugs: string[] = [];
    for await (const loc of h.client.listLocations({ state: 'OR', limit: 1 })) slugs.push(loc.slug);
    expect(slugs).toEqual(['a', 'b']);
    expect(h.sent.map((s) => s.url)).toEqual([
      'https://api.oureawx.com/api/v1/locations/or?limit=1',
      'https://api.oureawx.com/api/v1/locations/or?cursor=b&limit=1',
    ]);
    const first = await h.client.listLocations();
    expect(first.nextCursor).toBe('b');
    expect(new URL(h.sent[2]?.url ?? '').pathname).toBe('/api/v1/locations');
  });

  it('pages the station catalog with repeated capabilities', async () => {
    const h = harness([{ body: JSON.stringify({ items: [{ slug: 's' }], next_cursor: null }) }]);
    const pages = [];
    for await (const p of h.client
      .listCatalogStations({ capability: ['swe', 'air_temp'], network: ['Snotel'] })
      .pages()) {
      pages.push(p);
    }
    expect(pages).toHaveLength(1);
    expect(queryOf(h.sent[0])).toBe('capability=air_temp&capability=swe&network=Snotel');
  });
});

describe('probabilities and totals', () => {
  it('maps results back to the caller order and keeps a null probability absent', async () => {
    const h = harness([{ body: body('forecast-prob-snow') }], { units: 'imperial' });
    const f = await h.client.getForecast('or/mt-hood-meadows', {
      prob: [atLeast('snowfall', inches(12), { window: 240 }), atLeast('snowfall', inches(6))],
      totals: [],
    });
    expect(f.probabilities?.map((p) => p.probability)).toEqual([null, 0.42]);
  });

  it('fails loudly when the body answers some terms but not all', async () => {
    const h = harness([{ body: body('forecast-totals') }]);
    await expect(
      h.client.getForecast('or/x', { totals: [windowTotal('snowfall', 72)] }),
    ).rejects.toThrow(/no window total/);
  });

  it('refuses an invalid term before sending', async () => {
    const h = harness([]);
    await expect(
      h.client.getForecast('or/x', { prob: [atLeast('snowfall', 1, { aggregation: 'any' })] }),
    ).rejects.toBeInstanceOf(UsageError);
    expect(h.sent).toHaveLength(0);
  });
});

describe('retries and timeouts', () => {
  it('retries a connection error with backoff, then succeeds', async () => {
    const h = harness([{ error: new TypeError('fetch failed') }, { body: body('attribution') }]);
    await h.client.getAttribution();
    expect(h.delays).toEqual([0.5]);
  });

  it('caps the backoff at 8 s', async () => {
    const failures = Array.from({ length: 6 }, () => ({ status: 502, body: 'x' }));
    const h = harness(failures, { maxRetries: 5 });
    await expect(h.client.getAttribution()).rejects.toBeInstanceOf(UnavailableError);
    expect(h.delays).toEqual([0.5, 1, 2, 4, 8]);
  });

  it('honours an HTTP-date Retry-After on 503', async () => {
    const h = harness([
      { status: 503, headers: { 'Retry-After': 'Sun, 15 Nov 2026 00:00:10 GMT' }, body: '{}' },
      { body: body('attribution') },
    ]);
    await h.client.getAttribution();
    expect(h.delays).toEqual([10]);
  });

  it('retries a 429 without Retry-After with jitter and reports retryAfter when given', async () => {
    const h = harness([
      { status: 429, body: '{}' },
      { status: 429, headers: { 'Retry-After': '61' }, body: '{}' },
    ]);
    const error = (await h.client.getAttribution().catch((e: unknown) => e)) as RateLimitError;
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(61);
    expect(h.delays).toEqual([0.5]);
  });

  it('parses Retry-After forms', () => {
    expect(parseRetryAfter(null, 0)).toBeUndefined();
    expect(parseRetryAfter('garbage', 0)).toBeUndefined();
    expect(parseRetryAfter(' 7 ', 0)).toBe(7);
  });

  it('times out an attempt as a connection error', async () => {
    const hang = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    const client = new Ourea({ apiKey: null, fetch: hang, timeoutMs: 5, maxRetries: 0 });
    await expect(client.getAttribution()).rejects.toBeInstanceOf(ConnectionError);
  });

  it('rejects with the caller’s abort reason, without retrying', async () => {
    const controller = new AbortController();
    const reason = new Error('user cancelled');
    const h = harness([{ error: new TypeError('fetch failed') }]);
    controller.abort(reason);
    await expect(h.client.getAttribution({ signal: controller.signal })).rejects.toBe(reason);
    expect(h.sent).toHaveLength(0);
  });
});

describe('cache', () => {
  it('serves a fresh max-age entry without a request, then revalidates', async () => {
    const h = harness([
      { body: body('attribution'), headers: { 'Cache-Control': 'max-age=60', ETag: '"x"' } },
    ]);
    await h.client.getAttribution();
    const second = await h.client.getAttribution();
    expect(h.sent).toHaveLength(1);
    expect(second.meta.revalidated).toBe(false);
  });

  it('exposes response metadata without polluting the data', async () => {
    const h = harness([
      {
        body: body('attribution'),
        headers: {
          'X-Request-Id': 'r1',
          'RateLimit-Remaining': '5',
          'RateLimit-Policy': '60;w=60',
        },
      },
    ]);
    const result = await h.client.getAttribution();
    expect(result.meta.requestId).toBe('r1');
    expect(result.meta.rateLimit).toEqual({
      limit: undefined,
      remaining: 5,
      reset: undefined,
      policy: '60;w=60',
    });
    expect(h.client.rateLimit?.remaining).toBe(5);
    expect(Object.keys(result)).toEqual(['providers']);
  });

  it('bounds the LRU by entries and bytes', () => {
    const cache = new MemoryCache({ maxEntries: 2, maxBytes: 10 });
    const entry = (b: string) => ({ etag: undefined, body: b, storedAt: 0, maxAge: 0 });
    cache.set('a', entry('1'));
    cache.set('b', entry('2'));
    cache.get('a');
    cache.set('c', entry('3'));
    expect([cache.get('a'), cache.get('b'), cache.get('c')].map((e) => e?.body)).toEqual([
      '1',
      undefined,
      '3',
    ]);
    cache.set('big', entry('x'.repeat(11)));
    expect(cache.get('big')).toBeUndefined();
    cache.set('d', entry('123456789'));
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('hashes keys with SHA-256', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
  });
});
