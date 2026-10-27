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
    hits.items.some((h) => h.key === 'or/mt-hood-meadows'),
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

if (failures.length > 0) process.exit(1);
