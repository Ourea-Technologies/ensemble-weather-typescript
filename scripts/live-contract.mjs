#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// A short read-only contract run against the LIVE API, for the nightly
// live.yml workflow only (it needs OUREA_API_KEY from Actions secrets). Never
// run it from tests or examples. Uses the built package.

import { Ourea, atLeast, inches, windowTotal } from '../dist/esm/index.js';

if (!process.env.OUREA_API_KEY) {
  console.error('live-contract: OUREA_API_KEY is not set');
  process.exit(1);
}

const ourea = new Ourea();
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check('search finds the quickstart location', async () => {
  const hits = await ourea.searchLocations('mt hood meadows');
  assert(
    hits.items.some((h) => h.state === 'or' && h.slug === 'mt-hood-meadows'),
    'or/mt-hood-meadows not in the hits',
  );
});
await check('forecast answers prob and totals in the caller order', async () => {
  const f = await ourea.getForecast('or/mt-hood-meadows', {
    prob: [atLeast('snowfall', inches(12), { window: 72 }), atLeast('snowfall', inches(6))],
    totals: [windowTotal('snowfall', 72), windowTotal('precipitation', 24)],
  });
  assert(f.probabilities?.length === 2, 'two probabilities');
  assert(
    f.probabilities[0].windowEndHours === 72 && f.probabilities[1].windowEndHours === 24,
    'caller order',
  );
  assert(f.windowTotals?.[0]?.variable === 'snowfall', 'totals in caller order');
  assert(f.meta.status === 200, 'status 200');
});
await check('a repeated forecast revalidates (304)', async () => {
  const f = await ourea.getForecast('or/mt-hood-meadows');
  assert(f.location.slug === 'mt-hood-meadows', 'slug');
});
await check('catalog first page and attribution', async () => {
  const page = await ourea.listCatalogLocations({ limit: 5 });
  assert(page.items.length > 0, 'catalog items');
  const attribution = await ourea.getAttribution();
  assert(attribution.providers.length > 0, 'providers');
});
await check('out-of-coverage maps to OutsideCoverageError', async () => {
  const error = await ourea.getPointForecast({ lat: 51.5, lon: -0.1 }).then(
    () => undefined,
    (e) => e,
  );
  assert(error?.category === 'outside_coverage', `category ${String(error?.category)}`);
});

await check('members: plume returns the plume columns', async () => {
  const f = await ourea.getForecast('or/mt-hood-meadows', { members: 'plume', maxHours: 12 });
  assert(f.forecast.plume !== undefined, 'forecast.plume');
});
await check('explore ranks and pages', async () => {
  const page = await ourea.explore('snow_5d', { limit: 3 });
  assert(page.items[0]?.rank === 1, 'rank 1 first');
  let n = 0;
  for await (const item of ourea.explore('snow_5d', { state: 'wa', limit: 50 })) {
    assert(item.rank > n, 'ranks ascend');
    n = item.rank;
  }
});
await check('search sorted by a metric near a point', async () => {
  const hits = await ourea.searchLocations('hood', {
    sort: 'snow_5d',
    near: { lat: 45.33, lon: -121.66 },
  });
  assert(
    hits.items.some((h) => h.explore !== undefined && h.explore !== null),
    'a hit with explore',
  );
});
await check('composition, season, snowpack and its plume', async () => {
  assert((await ourea.getComposition()).totalMembers > 0, 'members');
  assert((await ourea.getSeason('or/mt-hood-meadows')).waterYear >= 2027, 'water year');
  assert((await ourea.getSnowpack('or/mt-hood-meadows')).beta, 'snowpack beta');
  assert((await ourea.getSnowpackPlume('or/mt-hood-meadows')).beta, 'plume beta');
});
await check('the snow trend (Plus or Pro; PLUS_REQUIRED otherwise)', async () => {
  const result = await ourea.getSnowTrend('or/mt-hood-meadows').then(
    (r) => r,
    (e) => e,
  );
  assert(
    Array.isArray(result.grids) || result?.code === 'PLUS_REQUIRED',
    `grids or PLUS_REQUIRED, got ${String(result?.code)}`,
  );
});
await check('GeoJSON: alert outlines and avalanche zones', async () => {
  const outlines = await ourea.getAlertOutlines({ classes: ['winter'] });
  assert(outlines.type === 'FeatureCollection', 'outlines collection');
  const zones = await ourea.getAvalancheZones();
  assert(zones.features.length > 0, 'zones');
});
await check('a mountain pass carries its pass forecast', async () => {
  const current = await ourea.getCurrent('wa/snoqualmie-pass-i-90');
  assert(current.pass?.chances.pSnowGe1in.members !== undefined, 'pass chances');
});

if (failures.length > 0) process.exit(1);
