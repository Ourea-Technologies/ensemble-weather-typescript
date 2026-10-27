// SPDX-License-Identifier: BSD-2-Clause
// Imports the BUILT ES module build and makes one call through a mock fetch.
// Run by scripts/smoke.mjs under Node, Deno and Bun.
import { Ourea, atLeast, inches, VERSION } from '../../dist/esm/index.js';

const sent = [];
const body = JSON.stringify({
  location: { slug: 'mt-hood-meadows', name: 'Mt. Hood Meadows' },
  units: 'metric',
  probabilities: [
    {
      variable: 'snowfall',
      op: 'ge',
      threshold: 152.4,
      window_start_hours: 0,
      window_end_hours: 24,
      aggregation: 'total',
      probability: 0.42,
      members: 131,
    },
  ],
});
const ourea = new Ourea({
  apiKey: null,
  fetch: (url, init) => {
    sent.push({ url, headers: new Headers(init.headers) });
    return Promise.resolve(
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  },
});
const forecast = await ourea.getForecast('or/mt-hood-meadows', {
  prob: [atLeast('snowfall', inches(6))],
});
const url = sent[0]?.url;
if (
  url !== 'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:152.40:24h'
) {
  throw new Error(`unexpected URL ${url}`);
}
if (forecast.probabilities?.[0]?.probability !== 0.42) throw new Error('probability not mapped');
console.log(
  `ok ${VERSION} ${sent[0].headers.get('User-Agent') ?? '(no User-Agent: browser-like runtime)'}`,
);
