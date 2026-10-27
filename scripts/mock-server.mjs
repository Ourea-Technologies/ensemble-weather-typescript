#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// A tiny stand-in for the Ourea API, serving the shared vector bodies, so the
// examples run in CI without a key and without calling the real API.
//
//   node scripts/mock-server.mjs     serve on http://127.0.0.1:8787 until stopped
//
// It is a test stub: its probabilities and totals are canned numbers, not
// forecasts.

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bodies = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'vectors', 'bodies');
const load = (name) => JSON.parse(readFileSync(join(bodies, `${name}.json`), 'utf8'));

const ATTRIBUTION = {
  sources: ['ecmwf-ifs-ens', 'noaa-gefs'],
  credit: 'Forecast by Ourea from ECMWF and NOAA ensemble data.',
  url: 'https://oureawx.com/attribution',
};

function windowOf(text) {
  const m = /^(?:(\d+)-)?(\d+)h$/.exec(text ?? '24h');
  return { start: Number(m?.[1] ?? 0), end: Number(m?.[2] ?? 24) };
}

function forecast(params, point) {
  const units = params.get('units') ?? 'metric';
  const body = load(units === 'imperial' ? 'forecast-imperial' : 'forecast-metric');
  body.units = units;
  const prob = params.get('prob');
  if (prob) {
    body.probabilities = prob.split(',').map((term, i) => {
      const [variable, op, threshold, window, aggregation] = term.split(':');
      const { start, end } = windowOf(window);
      const amount = variable === 'precipitation' || variable === 'snowfall';
      return {
        variable,
        op,
        threshold: Number(threshold),
        window_start_hours: start,
        window_end_hours: end,
        aggregation: aggregation ?? (amount ? 'total' : 'any'),
        from: '2026-11-15T00:00:00Z',
        to: '2026-11-16T00:00:00Z',
        probability: [0.42, 0.18, 0.73, 0.05][i % 4],
        members: 131,
      };
    });
  }
  const totals = params.get('totals');
  if (totals) {
    const canned = load('forecast-totals').window_totals[0].quantiles;
    body.window_totals = totals.split(',').map((term) => {
      const [variable, window] = term.split(':');
      const { start, end } = windowOf(window);
      return {
        variable,
        window_start_hours: start,
        window_end_hours: end,
        from: '2026-11-15T00:00:00Z',
        to: '2026-11-17T00:00:00Z',
        quantiles: canned,
        members: 131,
      };
    });
  }
  if (point) {
    body.point = {
      requested_lat: point.lat,
      requested_lon: point.lon,
      lat: point.lat,
      lon: point.lon,
      resolution_deg: 0.01,
      elevation: point.elevation ?? 1661,
      elevation_source: point.elevation === undefined ? 'dem_3dep_10m' : 'request',
      state: 'or',
    };
  }
  return body;
}

function current(units) {
  const location = load('forecast-metric').location;
  return {
    location,
    alerts: [],
    alerts_as_of: '2026-11-15T00:00:00Z',
    sensor_count: 0,
    sensors: [],
    current: {
      time: '2026-11-15T00:00:00Z',
      temperature: units === 'imperial' ? 28.4 : -2.0,
      condition: 'snow',
      condition_text: 'Snow',
      condition_icon: 'night_snow',
      wind_speed: units === 'imperial' ? 13.4 : 6.0,
      wind_direction: 5,
      source: 'nowcast',
    },
    as_of: '2026-11-15T00:00:00Z',
    model_run_initialized_at: '2026-11-15T00:00:00Z',
    nowcast_hours: null,
    units,
    attribution: ATTRIBUTION,
  };
}

function alerts() {
  return {
    location: load('forecast-metric').location,
    alert_count: 1,
    as_of: '2026-11-15T00:00:00Z',
    alerts: [
      {
        id: 'urn:oid:2.49.0.1.840.0.example',
        event: 'Winter Storm Warning',
        severity: 'Severe',
        urgency: 'Expected',
        headline: 'Winter Storm Warning until 4 PM PST Sunday',
        expires: '2026-11-16T00:00:00Z',
      },
    ],
    attribution: ATTRIBUTION,
  };
}

const outside = (lat, lon) => !(lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66);

function route(path, params) {
  if (/^\/api\/v1\/locations\/[^/]+\/[^/]+$/.test(path)) return [200, forecast(params)];
  if (/^\/api\/v1\/locations\/[^/]+\/[^/]+\/current$/.test(path)) {
    return [200, current(params.get('units') ?? 'metric')];
  }
  if (/^\/api\/v1\/locations\/([^/]+)\/([^/]+)\/alerts$/.test(path)) return [200, alerts()];
  if (path === '/api/v1/forecast' || path === '/api/v1/current' || path === '/api/v1/alerts') {
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (outside(lat, lon)) {
      return [
        400,
        {
          error: 'OUTSIDE_COVERAGE',
          message: `${String(lat)},${String(lon)} is outside the forecast domain (CONUS).`,
        },
      ];
    }
    if (path === '/api/v1/current') return [200, current(params.get('units') ?? 'metric')];
    if (path === '/api/v1/alerts') return [200, alerts()];
    const elevation = params.get('elevation_m');
    return [
      200,
      forecast(params, { lat, lon, elevation: elevation === null ? undefined : Number(elevation) }),
    ];
  }
  if (path === '/api/v1/search/locations') return [200, load('search')];
  if (path === '/api/v1/catalog/locations') {
    return [200, load(params.get('cursor') === 'c2' ? 'catalog-page-2' : 'catalog-page-1')];
  }
  if (/^\/api\/v1\/catalog\/locations\/[^/]+$/.test(path)) return [200, load('catalog-detail')];
  if (path === '/api/v1/attribution') return [200, load('attribution')];
  return [404, { error: 'NOT_FOUND', message: `No route for ${path}` }];
}

/** Starts the mock on `port` (0 = any free port). Resolves to its base URL and a close function. */
export function startMockServer(port = 0) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const [status, body] = route(url.pathname, url.searchParams);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=0' };
    if (req.headers['x-api-key'] !== undefined) {
      Object.assign(headers, {
        'RateLimit-Limit': '600',
        'RateLimit-Remaining': '599',
        'RateLimit-Reset': '60',
        'RateLimit-Policy': '600;w=60',
      });
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${String(address.port)}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startMockServer(Number(process.env.PORT ?? 8787));
  console.log(`mock Ourea API on ${url} (OUREA_BASE_URL=${url})`);
}
