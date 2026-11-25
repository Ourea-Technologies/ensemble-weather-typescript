# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-24

The first release on npm. Targets the v1 contract at ensemble-weather-spec
40c2ae8 (the server's public spec at 256cd770, byte for byte).

### Added since the v1 contract of 2026-10-27

- `explore(metric, options)`: places ranked by a metric (`ExploreMetric`),
  with `order`, `type`, `state`, `near`, `radiusKm`, elevation bounds,
  `points` and cursor paging (await a page, or `for await` every place).
- `getSeason`, `getSnowTrend` (Plus or Pro), `getSnowpack` and
  `getSnowpackPlume` (beta), `getComposition` (an open route, sent without
  the key), and the GeoJSON routes `getAlertOutlines` and
  `getAvalancheZones`.
- `searchLocations` takes `sort`, `order`, `near`, `radiusKm` and `units`; a
  hit carries `explore` with a metric sort.
- `members: 'plume'` on the forecast routes: the plume view in
  `forecast.plume` (`MemberPlume`); `membersView` may be `pool`.
- Every new response field of the contract, among them
  `ForecastResponse.location` as `ForecastLocation` (`elevation`,
  `elevations`), `snowOnGround`, `avalanche`; `snowLevelWetBulb`;
  `TimeSeriesPoint.measured`, `snowCharacter`, `membersSpread`,
  `members6h`, `precipitationByType`; the daily normals, departures and
  percentiles; `CurrentConditions.measured` and `cloudCover`;
  `CurrentResponse.summary` and `pass`; `SensorObservation.distanceKm` and
  `elevationDiff`; the NWS fields on `ActiveAlert`; `WindowTotal.method`.
  The compile-time drift checks cover all of them (137 models).
- `PLUS_REQUIRED` is a `permission` error; `examples/snow-report.ts`.

### Changed

- Stuttering JSON fields have SDK names (BEHAVIOR.md 3.0, one table for every
  Ourea SDK, applied by a decoder table generated from the spec,
  `src/internal/renames.ts`): `ForecastResponse.forecast` is `series` and
  `elevationForecasts` is `elevations`; `CurrentResponse.current` is `now`;
  `ProbabilityResult.probability` is `value`; the list responses' rows are
  `items` and their counts `count` (`alerts`, `alertCount`, `locations`,
  `runs`; nearby's `location` is `origin`); an hour's `validTime` and
  `leadTimeHours` are `validAt` and `leadHours`; `WindowTotal.windowStartHours`
  and `windowEndHours` are `startHours` and `endHours`; `CurrentConditions`
  `condition`, `conditionText`, `conditionIcon` are `code`, `text`, `icon`; an
  elevation's `elevation` is `height`; and the rest of the README's "Names
  that differ from the API's JSON". Each renamed field's doc names its JSON
  field.
- `LocationElevation` is `ElevationSummary`, the spec's name, and has
  `displayName`. `MembersCumulative` holds `MemberQuantiles`.
- Comma lists (`sources`, `excludeSources`, `elevations`, `include`,
  `capability`, `network`, ...) are sent sorted, each item encoded and the
  commas literal (`sources=asos,snotel`, not `%2C`): the server's canonical
  spelling and the edge-cache key every SDK shares (BEHAVIOR.md 3.1).
- `searchLocations` sends the client's `units` (the route takes it now).

### Fixed

- `scripts/live-contract.mjs` looked for the search hit `key`
  `or/mt-hood-meadows`; the live key is `or-mt-hood-meadows`, so it now
  matches on state and slug.

### Changes from the draft of 2026-10-26 (never published)

The v1 contract as deployed (ensemble-weather-spec 8b85fea, KAN-1561).

#### Changed

- The coordinate methods follow the operation ids: `getCurrentAt` is
  `getPointCurrent`, `getAlertsAt` is `getPointAlerts` and `getNearbyAt` is
  `getPointNearby`, beside `getPointForecast`. There are no aliases.
- `precip*` fields are `precipitation*` everywhere: `DailyForecast.totalPrecipitation`,
  `totalPrecipitationIfWet`, `precipitationProbability`,
  `precipitationOccurrenceProbability`, `precipitationType`, `precipitationDisplay`;
  `TimeSeriesPoint.precipitationType`; `CurrentConditions.precipitationProbability`;
  `SensorObservation.precipitationRate`; `ProbabilityThresholds.dailyPrecipitation*`.
- `EnsembleStats.windDirection` (and `ModelStats.windDirection`) is a `CircularStats`
  (`mean`, `stddev`, `sector50`, `sector90`), not `Quantiles`; `windDirectionCircular`
  is gone.
- Probabilities and window totals are mapped back to your terms by the `term` each
  result echoes, never by position. `ProbabilityResult` and `WindowTotal` carry `term`
  and `nullReason`; `WindowTotal` carries `aggregation`.
- `ActiveAlert.severity` and `urgency` are snake_case enums; `certainty` is new.
  `CurrentStation.stationId` is new. `LocationRef.slug` and `type` may be `null` on a
  coordinate forecast. Catalog `network`, `stationStatus` and `templateVariant` are
  snake_case enums (`StationNetwork`, `StationStatus`, `TemplateVariant`).
- Fields the server now omits instead of sending `null` are optional, not nullable
  (catalog text fields, `gapFlow`, `snowOutlook`, daily `wind`, `feelsLike*`, ...).
- `getRuns` returns a `PageRequest` (await it for a page, `for await` it for every run)
  and takes `cursor`; `RunsResponse.nextCursor` is new. `LimitOptions` is `RunsOptions`.
- `listCatalogStations` sends `capability` and `network` as one sorted comma list.
- Errors: the 16 public codes (`AUTH_UNAVAILABLE` is new and `unavailable`;
  `FORBIDDEN`, `GONE`, `MODEL_RUN_NOT_FOUND`, `AMBIGUOUS`, `INVALID_MAX_HOURS` and
  `FEELS_LIKE_UNAVAILABLE` are gone and now map by status). `ApiError` gains `docUrl`
  and `param`, and `requestId` comes from the body's `request_id` when present.
  `OUTSIDE_COVERAGE` is a 404. `Retry-After` is honoured on 504 as well as 429 and 503.

#### Added

- Forecast option `include` (`skin_temperature`, `mslp`).

#### Removed

- `getStormReports`, `getStormReport`, `StormReportsResponse` and `StormReportCard`
  (not in the public API).
- Forecast options `diagnostics: ['ptype']` and `feelsLike: ['utci']`, the
  `feelsLikeUtci*` and `ensemble.ptype` fields, and `ElevationForecast.timeseries` /
  `default` (`ElevationTimeSeriesPoint`).
- Catalog detail `ads` (and its ad-slot models) and `include: ['ads']`.

### In the draft of 2026-10-26

#### Added

- `Ourea`, the client for API v1 (contract 1.0.0): every operation except
  `getMapsToken`, each taking `{ signal }`.
- Probability terms (`atLeast`, `atMost`) and window totals (`windowTotal`),
  computed server-side, returned in the caller's order with their reference
  class; thresholds in any unit (`inches`, `fahrenheit`, ...) converted exactly.
- Hand-written, camelCase models for every response schema, with open enums.
- Canonical request URLs, keyless open routes, same-host redirects, retries
  with `Retry-After` and full-jitter backoff, an ETag cache on by default,
  deprecation warnings, rate-limit state on every result.
- Typed errors under `OureaError`, one class per category.
- ESM and CommonJS builds with types for both; zero runtime dependencies;
  Node.js 18+, browsers, Deno, Bun and Cloudflare Workers.

[Unreleased]: https://github.com/Ourea-Technologies/ensemble-weather-typescript/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Ourea-Technologies/ensemble-weather-typescript/releases/tag/v0.1.0
