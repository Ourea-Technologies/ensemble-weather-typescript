# ensemble-weather

Official TypeScript/JavaScript SDK for the [Ourea](https://oureawx.com) probabilistic weather API.

[![CI](https://github.com/Ourea-Technologies/ensemble-weather-typescript/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Ourea-Technologies/ensemble-weather-typescript/actions/workflows/ci.yml?query=branch%3Amain)
[![Security](https://github.com/Ourea-Technologies/ensemble-weather-typescript/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Ourea-Technologies/ensemble-weather-typescript/actions/workflows/security.yml?query=branch%3Amain)
[![npm](https://img.shields.io/npm/v/ensemble-weather)](https://www.npmjs.com/package/ensemble-weather)
[![Node.js](https://img.shields.io/node/v/ensemble-weather)](https://www.npmjs.com/package/ensemble-weather)
[![License: BSD-2-Clause](https://img.shields.io/badge/license-BSD--2--Clause-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-docs.oureawx.com-informational)](https://docs.oureawx.com/typescript)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Ourea-Technologies/ensemble-weather-typescript/badge)](https://scorecard.dev/viewer/?uri=github.com/Ourea-Technologies/ensemble-weather-typescript)

Forecasts for the contiguous United States from a blend of up to five ensemble
weather models, with every hour's full distribution. Zero runtime
dependencies; runs in Node.js 18+, browsers, Deno, Bun and Cloudflare Workers.

## Install

```sh
npm install ensemble-weather
```

## Quickstart

No signup and no API key. This is [`examples/quickstart.ts`](examples/quickstart.ts),
which CI runs on every change:

```ts
// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon (no API key).
// Prints the next 24 hours' temperature as a p10-p90 range, and the chance
// of at least 6 in (15 cm) of snow in the next 24 hours.
import { Ourea, atLeast, inches, range } from 'ensemble-weather';

const ourea = new Ourea();
const forecast = await ourea.getForecast('or/mt-hood-meadows', {
  prob: [atLeast('snowfall', inches(6), { window: { hours: 24 } })],
});

const degrees = forecast.units === 'imperial' ? '°F' : forecast.units === 'kelvin' ? 'K' : '°C';
console.log(`${forecast.location.name}: temperature over the next 24 h (p10 to p90)`);
for (const hour of forecast.forecast.timeseries?.slice(0, 25) ?? []) {
  const t = range(hour.ensemble.temperature, 'p10', 'p90');
  if (t) console.log(`  ${hour.validTime}  ${String(t.low)} to ${String(t.high)} ${degrees}`);
}

const snow = forecast.probabilities?.[0];
if (snow?.probability != null) {
  const percent = Math.round(snow.probability * 100);
  console.log(
    `Chance of 6 in (15 cm) or more of snow in the next 24 h: ${String(percent)}% (${String(snow.members)} members)`,
  );
} else {
  console.log('The chance of 6 in of snow is not available for this window yet.');
}
```

It has no type annotations, so it runs unchanged as `quickstart.mjs` on
Node.js 18+, and as TypeScript. CommonJS works too:
`const { Ourea } = require('ensemble-weather')`.

## Authentication

Pass a key to the constructor, or set the `OUREA_API_KEY` environment variable:

```ts
const ourea = new Ourea({ apiKey: 'ow_...' }); // or: OUREA_API_KEY=ow_... node app.js
```

|                                                      | Anonymous                  | Free key                   | Pro key                                                               |
| ---------------------------------------------------- | -------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Named-location forecasts, current conditions, alerts | 10-day horizon, latest run | 10-day horizon, latest run | 15-day horizon, past runs, per-model breakdowns, all member variables |
| Forecasts at any coordinates (`getPointForecast`)    | no                         | no                         | yes                                                                   |
| Search and catalog                                   | yes                        | yes                        | yes, larger list budgets                                              |

See [pricing](https://oureawx.com/pricing). Search, catalog details and
attribution are always sent **without** the key, even when you have one, so
every caller shares one edge-cache entry; catalog list pages and forecasts are
sent with it. Set `sendKeyOnOpenRoutes: true` to attribute every request to
your key. The key is never logged, never in an error message, and never sent
to another host on a redirect. In a browser, keep keys server-side.

## Probabilities, not single numbers

Every forecast value is a distribution (`Quantiles`: mean, p10, p25, p50, p75,
p90, min, max). Ask the server for the probabilities and totals you need:

```ts
import { atLeast, atMost, fahrenheit, inches, windowTotal, range } from 'ensemble-weather';

// The chance of a threshold, over a window, with its reference class.
const f = await ourea.getForecast('or/mt-hood-meadows', {
  prob: [
    atLeast('snowfall', inches(12), { window: { hours: 72 } }),
    atMost('temperature', fahrenheit(32), {
      window: { startHours: 6, endHours: 18 },
      aggregation: 'all',
    }),
  ],
  totals: [windowTotal('snowfall', { hours: 72 })],
});
for (const p of f.probabilities ?? []) {
  console.log(p.variable, p.op, p.threshold, p.windowEndHours, p.probability, p.members);
}

// A storm total: the distribution of each member's own total over the window.
const storm = f.windowTotals?.[0]?.quantiles; // null when the run does not cover the window

// Quantiles: the served ranges, by name.
const hour = f.forecast.timeseries?.[0];
const spread = hour && range(hour.ensemble.temperature, 'p10', 'p90');
```

The SDK never sums, averages or interpolates quantiles, and never derives a
probability from them: the server computes every probability and window total
from the full ensemble (summing hourly quantiles gives a wrong storm total).
Thresholds you give in another unit (`inches(6)` on a metric request) are
converted exactly before sending; response values are always in the request's
units. Answers come back in the order you asked, and a `null` probability
means the forecast does not reach the window's end, never 0. More at
[docs.oureawx.com/concepts/probabilities](https://docs.oureawx.com/concepts/probabilities).

## More examples

| Example                                                   | Shows                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`quickstart.ts`](examples/quickstart.ts)                 | the program above, anonymous                                            |
| [`point-forecast.ts`](examples/point-forecast.ts)         | a forecast at coordinates with elevation (Pro key from `OUREA_API_KEY`) |
| [`chance-of-snow.ts`](examples/chance-of-snow.ts)         | several `prob` terms in one call, with their windows and member counts  |
| [`storm-total.ts`](examples/storm-total.ts)               | `totals` window distributions for precipitation and snowfall            |
| [`search-and-catalog.ts`](examples/search-and-catalog.ts) | search, then page through the catalog with the cursor                   |
| [`current-and-alerts.ts`](examples/current-and-alerts.ts) | current conditions and active alerts for a location                     |
| [`error-handling.ts`](examples/error-handling.ts)         | catching an out-of-coverage error by its type; reading rate-limit state |
| [`units.ts`](examples/units.ts)                           | the same forecast in metric and imperial                                |

Run them all against a local mock of the API with `npm run build && npm run examples`.

## Errors, retries and rate limits

Every error is an `OureaError` with a stable `category`. HTTP errors are
`ApiError`s carrying `status`, `code` (verbatim, even when new), `message`,
`requestId` and, on 429, `retryAfter` seconds:

| Class                  | Category           | When                                                               |
| ---------------------- | ------------------ | ------------------------------------------------------------------ |
| `AuthenticationError`  | `authentication`   | invalid or missing key (401)                                       |
| `PermissionError`      | `permission`       | your plan does not allow it, e.g. `PRO_REQUIRED` (403)             |
| `NotFoundError`        | `not_found`        | no such location, run or report (404, 410)                         |
| `InvalidRequestError`  | `invalid_request`  | the server rejected a parameter (400)                              |
| `OutsideCoverageError` | `outside_coverage` | `OUTSIDE_COVERAGE`: the point is outside the domain                |
| `RateLimitError`       | `rate_limited`     | over a budget (429)                                                |
| `UnavailableError`     | `unavailable`      | the server could not answer (5xx)                                  |
| `ConnectionError`      | `connection`       | no response: DNS, TLS, reset, or the 30 s per-attempt timeout      |
| `UsageError`           | `usage`            | refused before sending: an invalid term, an unserved quantile pair |

```ts
try {
  await ourea.getPointForecast({ lat: 51.5, lon: -0.1 });
} catch (error) {
  if (error instanceof OutsideCoverageError) console.log(error.code, error.message);
  else throw error;
}
```

Connection errors (except TLS verification failures), 429, 502, 503 and 504
are retried up to `maxRetries` (default 2) times, waiting exactly `Retry-After`
when the server sends one of 60 s or less (more than that is returned
immediately as the error), else full-jitter backoff from 0.5 s up to 8 s.
Nothing else is retried. Every call takes `{ signal }` to cancel it.

Each result has a non-enumerable `meta` with `rateLimit` (`limit`,
`remaining`, `reset`, `policy` from the `RateLimit-*` headers), `requestId`
and `revalidated`; `ourea.rateLimit` holds the last response's state. Read
them rather than hard-coding limits. Repeated calls revalidate a local ETag
cache (on by default; `cache: false` or your own `CacheStore`), so an
unchanged forecast costs a `304`.

## Documentation

- Guides and concepts: [docs.oureawx.com](https://docs.oureawx.com)
- This SDK's guide: [docs.oureawx.com/typescript](https://docs.oureawx.com/typescript)
- API reference (TypeDoc): [jsDocs.io](https://www.jsdocs.io/package/ensemble-weather), or `npm run docs` locally
- The OpenAPI spec this SDK targets (API v1, contract 1.0.0): [ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec/blob/main/openapi/v1/openapi.yaml), pinned in [`spec/`](spec/README.md)

## Supported versions

Node.js 18, 20, 22 and 24 (tested in CI), current Deno and Bun (smoke-tested
in CI), Cloudflare Workers and evergreen browsers (anything with `fetch`).
TypeScript 5.0 or newer for the types. This is version 0.x; the API may change
before 1.0.

## Contributing, security, licence

- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security: report vulnerabilities privately as described in [SECURITY.md](SECURITY.md)
- Licence: [BSD-2-Clause](LICENSE), Copyright (c) 2026 Ourea Technologies
