// SPDX-License-Identifier: BSD-2-Clause
/**
 * Official TypeScript/JavaScript SDK for the [Ourea](https://oureawx.com)
 * probabilistic weather API.
 *
 * ```ts
 * import { Ourea, atLeast, inches } from 'ensemble-weather';
 * const ourea = new Ourea();
 * const forecast = await ourea.getForecast('or/mt-hood-meadows', {
 *   prob: [atLeast('snowfall', inches(6))],
 * });
 * ```
 *
 * Guides: https://docs.oureawx.com/typescript
 *
 * @packageDocumentation
 */

export {
  Ourea,
  DEFAULT_BASE_URL,
  type CatalogDetailOptions,
  type ClientOptions,
  type Coordinates,
  type CurrentOptions,
  type FetchLike,
  type ForecastOptions,
  type LimitOptions,
  type ListCatalogLocationsOptions,
  type ListCatalogStationsOptions,
  type ListLocationsOptions,
  type LocationForecastOptions,
  type LocationId,
  type Logger,
  type NearbyOptions,
  type PointWithElevation,
  type RequestOptions,
  type SearchOptions,
} from './client.js';
export { MemoryCache, type CacheEntry, type CacheStore, type MemoryCacheOptions } from './cache.js';
export {
  ApiError,
  AuthenticationError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  OureaError,
  OutsideCoverageError,
  PermissionError,
  RateLimitError,
  UnavailableError,
  UsageError,
  type ApiErrorDetails,
  type ErrorCategory,
} from './errors.js';
export { PageRequest } from './paging.js';
export {
  atLeast,
  atMost,
  windowTotal,
  type Aggregation,
  type ComparisonOp,
  type ProbabilityTerm,
  type ProbabilityVariable,
  type TermOptions,
  type TotalTerm,
  type TotalVariable,
  type Window,
} from './probability.js';
export { median, range, type QuantileRange } from './quantiles.js';
export type { DeprecationNotice, RateLimit, ResponseMeta, Result } from './response.js';
export {
  UNIT_SYSTEMS,
  celsius,
  centimeters,
  fahrenheit,
  feet,
  inches,
  kelvin,
  meters,
  metersPerSecond,
  millimeters,
  mph,
  type Threshold,
  type ThresholdUnit,
  type UnitSystem,
} from './units.js';
export { VERSION } from './version.js';
export * from './models/index.js';
