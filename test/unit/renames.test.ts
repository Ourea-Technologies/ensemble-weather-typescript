// SPDX-License-Identifier: BSD-2-Clause
// BEHAVIOR.md 3.0: the stuttering wire fields get their SDK names, only where
// the table says (the names/* vectors pin each row end to end).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { applyRenames, camelize } from '../../src/internal/camel.js';
import { RENAME_NODES, RENAME_ROOTS } from '../../src/internal/renames.js';
import { SPEC } from '../helpers.js';

const body = (name: string): unknown =>
  JSON.parse(readFileSync(join(SPEC, 'vectors', 'bodies', `${name}.json`), 'utf8'));

it('renames a forecast body and nothing else', () => {
  const f = applyRenames(camelize(body('forecast-full')), RENAME_ROOTS.getLocationForecast) as {
    forecast?: unknown;
    series: { timeseries: Record<string, unknown>[] };
    current: Record<string, unknown>;
  };
  expect(f.forecast).toBeUndefined();
  const hour = f.series.timeseries[0] ?? {};
  // valid_time does not repeat TimeSeriesPoint's word: it keeps its wire name.
  expect(Object.keys(hour)).toContain('validTime');
  // An hour's condition keeps its wire name: only CurrentConditions renames it.
  expect(Object.keys(hour)).toContain('conditionText');
  expect(Object.keys(f.current)).toContain('text');
  expect(Object.keys(f.current)).not.toContain('conditionText');
});

it('every rename node is reachable from an operation', () => {
  const reached = new Set<string>();
  const visit = (id: string): void => {
    if (reached.has(id)) return;
    reached.add(id);
    const node = RENAME_NODES[id];
    for (const child of [...Object.values(node?.fields ?? {}), ...(node?.union ?? [])])
      visit(child);
  };
  for (const root of Object.values(RENAME_ROOTS)) visit(root);
  const renaming = Object.entries(RENAME_NODES)
    .filter(([, n]) => n.rename !== undefined)
    .map(([id]) => id);
  for (const id of renaming) expect(reached, id).toContain(id);
});

it('starts no renames from a GeoJSON route', () => {
  expect(RENAME_ROOTS.getAvalancheZones).toBeUndefined();
  expect(RENAME_ROOTS.getAlertOutlines).toBeUndefined();
});
