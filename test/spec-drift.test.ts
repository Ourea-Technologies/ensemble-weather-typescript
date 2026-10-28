// SPDX-License-Identifier: BSD-2-Clause
// Spec drift (SDK-STANDARD.md "Tests"): every operation in the pinned spec is
// exposed, the SDK sends only parameters the spec defines, and the models
// round-trip every response example. Field-level drift is checked at compile
// time by test/generated/spec-checks.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Ourea } from '../src/index.js';
import { atLeast, windowTotal } from '../src/index.js';
import { camelize, camelKey } from '../src/internal/camel.js';
import { harness, SPEC } from './helpers.js';

interface ResponseObject {
  $ref?: string;
  content?: Record<string, { example?: unknown; examples?: Record<string, { value: unknown }> }>;
}

interface Operation {
  operationId: string;
  parameters?: ({ name: string; in: string } | { $ref: string })[];
  responses?: Record<string, ResponseObject>;
}

interface Spec {
  paths: Record<string, Record<string, Operation>>;
  components: {
    parameters: Record<string, { name: string; in: string }>;
    responses: Record<string, ResponseObject>;
    schemas: Record<string, unknown>;
  };
}

const spec = parse(readFileSync(join(SPEC, 'openapi', 'v1', 'openapi.yaml'), 'utf8')) as Spec;
const operations = Object.values(spec.paths).flatMap((item) =>
  Object.values(item).filter(
    (op): op is Operation => typeof op === 'object' && 'operationId' in op,
  ),
);

/** Each in-scope operationId, and how the SDK calls it with every option set. */
const CALLS: Record<string, (c: Ourea) => Promise<unknown>> = {
  getLocationForecast: (c) =>
    c.getForecast('or/x', {
      units: 'imperial',
      maxHours: 48,
      includePast: true,
      models: true,
      members: true,
      elevations: 'all',
      daily: false,
      maxDays: 3,
      hourly: false,
      run: '2026-11-15T00:00:00Z',
      sources: ['snotel'],
      excludeSources: ['raws'],
      nowcast: false,
      prob: [atLeast('snowfall', 1)],
      totals: [windowTotal('snowfall')],
      diagnostics: ['provenance'],
      include: ['mslp'],
      feelsLike: ['nws'],
    }),
  getPointForecast: (c) =>
    c.getPointForecast(
      { lat: 1, lon: 2, elevationM: 3 },
      {
        units: 'kelvin',
        maxHours: 48,
        includePast: true,
        models: true,
        members: true,
        daily: false,
        maxDays: 3,
        hourly: false,
        run: '2026-11-15T00:00:00Z',
        sources: ['snotel'],
        excludeSources: ['raws'],
        nowcast: false,
        prob: [atLeast('snowfall', 1)],
        totals: [windowTotal('snowfall')],
        diagnostics: ['provenance'],
        include: ['mslp'],
        feelsLike: ['nws'],
      },
    ),
  getCurrentConditions: (c) =>
    c.getCurrent('or/x', {
      units: 'imperial',
      sources: ['a'],
      excludeSources: ['b'],
      include: ['nowcast_hours'],
    }),
  getCurrentByCoordinates: (c) =>
    c.getCurrentAt(
      { lat: 1, lon: 2, elevationM: 3 },
      { units: 'imperial', sources: ['a'], excludeSources: ['b'], include: ['nowcast_hours'] },
    ),
  getLocationAlerts: (c) => c.getAlerts('or/x'),
  getAlertsByCoordinates: (c) => c.getAlertsAt({ lat: 1, lon: 2 }),
  getNearbyLocations: (c) => c.getNearby('or/x', { units: 'imperial', limit: 5, radiusKm: 10 }),
  getNearbyByCoordinates: (c) =>
    c.getNearbyAt({ lat: 1, lon: 2 }, { units: 'imperial', limit: 5, radiusKm: 10 }),
  searchLocations: (c) =>
    c.searchLocations('hood', { state: 'or', county: 'Hood River', type: 'ski_area', limit: 5 }),
  getAllLocations: async (c) =>
    c.listLocations({ type: 'ski_area', units: 'imperial', limit: 5, cursor: 'c' }).then((p) => p),
  getLocations: async (c) =>
    c
      .listLocations({ state: 'or', type: 'ski_area', units: 'imperial', limit: 5, cursor: 'c' })
      .then((p) => p),
  listCatalogLocations: async (c) =>
    c
      .listCatalogLocations({
        admin1: 'US-OR',
        country: 'US',
        type: 'ski_area',
        template: 'mountain',
        limit: 5,
        cursor: 'c',
      })
      .then((p) => p),
  getCatalogLocation: (c) => c.getCatalogLocation('x', { include: ['content'], locale: 'es' }),
  listCatalogStations: async (c) =>
    c
      .listCatalogStations({
        admin1: 'US-OR',
        country: 'US',
        network: ['snotel'],
        capability: ['swe'],
        status: 'active',
        limit: 5,
        cursor: 'c',
      })
      .then((p) => p),
  getCatalogStation: (c) => c.getCatalogStation('x', { include: ['content'], locale: 'es' }),
  getAvailableRuns: async (c) => c.getRuns({ limit: 5, cursor: 'c' }).then((p) => p),
  getAttribution: (c) => c.getAttribution(),
};

/** Out of SDK scope for 0.x (BEHAVIOR.md section 3). */
const OUT_OF_SCOPE = new Set(['getMapsToken']);

describe('spec drift', () => {
  it('exposes every operation in the spec', () => {
    const missing = operations
      .map((op) => op.operationId)
      .filter((id) => !OUT_OF_SCOPE.has(id) && !(id in CALLS));
    expect(missing).toEqual([]);
    const extra = Object.keys(CALLS).filter(
      (id) => !operations.some((op) => op.operationId === id),
    );
    expect(extra).toEqual([]);
  });

  for (const op of operations.filter((o) => !OUT_OF_SCOPE.has(o.operationId))) {
    it(`${op.operationId} sends only parameters its route defines`, async () => {
      const allowed = new Set(
        (op.parameters ?? [])
          .map((p) => ('$ref' in p ? spec.components.parameters[p.$ref.split('/').pop() ?? ''] : p))
          .filter((p) => p?.in === 'query')
          .map((p) => p?.name),
      );
      const h = harness([{ body: '{}' }], { apiKey: 'ow_k' });
      const call = CALLS[op.operationId];
      expect(call, op.operationId).toBeDefined();
      await call?.(h.client);
      const sent = [...new URL(h.sent[0]?.url ?? '').searchParams.keys()];
      for (const name of sent) expect(allowed, `${op.operationId}: ${name}`).toContain(name);
    });
  }

  // The camelCase -> snake_case table, from every property name in the spec.
  const snakeOf = new Map<string, string>();
  (function collect(node: unknown): void {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node) as [string, unknown][]) {
        if (k === 'properties' && v !== null && typeof v === 'object') {
          for (const name of Object.keys(v)) {
            const camel = camelKey(name);
            const prior = snakeOf.get(camel);
            if (prior !== undefined && prior !== name)
              throw new Error(`${prior} and ${name} both camelize to ${camel}`);
            snakeOf.set(camel, name);
          }
        }
        collect(v);
      }
    }
  })(spec.components.schemas);

  const OPAQUE = new Set(['body', 'config', 'externalLinks', 'lastReportSummary']);
  function snakeize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(snakeize);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [snakeOf.get(k) ?? k, OPAQUE.has(k) ? v : snakeize(v)]),
    );
  }

  const examples: [string, unknown][] = [];
  for (const op of operations.filter((o) => !OUT_OF_SCOPE.has(o.operationId))) {
    for (const [status, resp] of Object.entries(op.responses ?? {})) {
      const r =
        resp.$ref === undefined
          ? resp
          : spec.components.responses[resp.$ref.split('/').pop() ?? ''];
      const content = r?.content?.['application/json'];
      if (content?.example !== undefined)
        examples.push([`${op.operationId} ${status}`, content.example]);
      for (const [name, ex] of Object.entries(content?.examples ?? {})) {
        examples.push([`${op.operationId} ${status} ${name}`, ex.value]);
      }
    }
  }

  it('finds the spec examples', () => {
    expect(examples.length).toBeGreaterThan(50);
  });

  it.each(examples)('round-trips the example %s', (_label, example) => {
    expect(snakeize(camelize(example))).toEqual(example);
  });
});
