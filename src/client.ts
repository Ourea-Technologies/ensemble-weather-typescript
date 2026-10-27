// SPDX-License-Identifier: BSD-2-Clause
/**
 * The client.
 *
 * @module
 */

import { MemoryCache, type CacheStore } from './cache.js';
import { OureaError, UsageError } from './errors.js';
import { camelize } from './internal/camel.js';
import { encodeRfc3986, formatNumber, QueryBuilder } from './internal/query.js';
import { isBrowser, readEnv, runtimeToken } from './internal/runtime.js';
import {
  systemClock,
  Transport,
  type Clock,
  type FetchLike,
  type Logger,
} from './internal/transport.js';
import type {
  AttributionRegistry,
  CatalogLocation,
  CatalogLocationDetail,
  CatalogLocationPage,
  CatalogStation,
  CatalogStationDetail,
  CatalogStationPage,
  LocationsResponse,
  RunsResponse,
  SearchLocationsResponse,
  StormReportCard,
  StormReportsResponse,
} from './models/catalog.js';
import type { LocationSummary, LocationType } from './models/common.js';
import type {
  AlertsResponse,
  CurrentResponse,
  NearbyLocationsResponse,
  NearbyPointResponse,
} from './models/current.js';
import type { ForecastResponse, ProbabilityResult, WindowTotal } from './models/forecast.js';
import { PageRequest } from './paging.js';
import {
  probabilityResultKey,
  windowTotalKey,
  wireProbabilities,
  wireTotals,
  type ProbabilityTerm,
  type TotalTerm,
} from './probability.js';
import type { RateLimit, ResponseMeta, Result } from './response.js';
import { UNIT_SYSTEMS, type UnitSystem } from './units.js';
import { VERSION } from './version.js';

export type { FetchLike, Logger } from './internal/transport.js';

/** The production API. */
export const DEFAULT_BASE_URL = 'https://api.oureawx.com';

/** Client settings. Every one is optional. */
export interface ClientOptions {
  /**
   * The API key, sent as `X-API-Key`. Defaults to the `OUREA_API_KEY`
   * environment variable; with neither, calls are anonymous (Free tier),
   * which is valid. Pass `null` to stay anonymous whatever the environment says.
   */
  readonly apiKey?: string | null;
  /** Defaults to `OUREA_BASE_URL` from the environment, else `https://api.oureawx.com`. */
  readonly baseUrl?: string;
  /** The unit system for every request that accepts one. Default `metric`. */
  readonly units?: UnitSystem;
  /** Per-attempt timeout in milliseconds. Default 30 000. */
  readonly timeoutMs?: number;
  /** Retries after the first attempt (connection errors, 429, 502, 503, 504). Default 2; 0 disables. */
  readonly maxRetries?: number;
  /**
   * The ETag cache. On by default (an in-memory LRU, 256 entries / 32 MiB).
   * `false` disables it; pass a {@link CacheStore} to bring your own.
   */
  readonly cache?: boolean | CacheStore;
  /**
   * Also send the key on the open routes (search, catalog details,
   * attribution). Off by default: keyless requests share the edge cache.
   */
  readonly sendKeyOnOpenRoutes?: boolean;
  /** A `fetch` implementation (a proxy agent, a test double). Defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Your own product token, appended to the User-Agent (`my-app/2.1`). */
  readonly userAgent?: string;
  /** Where deprecation warnings go. Defaults to `console`. */
  readonly logger?: Logger;
  /** @internal Time and randomness for tests. */
  readonly clock?: Clock;
}

/** Options every call takes. */
export interface RequestOptions {
  /** Cancels the call (and any retry wait). */
  readonly signal?: AbortSignal;
}

/**
 * A named location: `"or/mt-hood-meadows"` (state and slug joined by its one
 * `/`), or the pair as an object. A two-letter state is lowercased; a state
 * name is passed through and the server redirects it.
 */
export type LocationId = string | { readonly state: string; readonly slug: string };

/** A point. Coordinates are sent exactly as given: the SDK never rounds them. */
export interface Coordinates {
  readonly lat: number;
  readonly lon: number;
}

/** A point with an optional elevation in metres (always metres, whatever the units). */
export interface PointWithElevation extends Coordinates {
  readonly elevationM?: number;
}

/** Forecast options shared by named locations and points. */
export interface ForecastOptions extends RequestOptions {
  /** Overrides the client's unit system for this call. */
  readonly units?: UnitSystem;
  /** Hours past the first served hour (6..360). Default 24. */
  readonly maxHours?: number;
  /** Serve the hourly series from the run's init, past hours included. */
  readonly includePast?: boolean;
  /** Per-model breakdowns (Pro). */
  readonly models?: boolean;
  /** Individual member values. */
  readonly members?: boolean;
  /** Daily summaries. Default true. */
  readonly daily?: boolean;
  /** How many daily rows (1..15). Default: the tier's horizon. */
  readonly maxDays?: number;
  /** The hourly series. Default true. */
  readonly hourly?: boolean;
  /** A specific model run's init time (Pro). */
  readonly run?: string | Date;
  /** Observation sources allowed into the nowcast blend. */
  readonly sources?: readonly string[];
  /** Observation sources kept out of the nowcast blend. */
  readonly excludeSources?: readonly string[];
  /** Blend live observations into the first hours. Default true. */
  readonly nowcast?: boolean;
  /**
   * Probabilities to compute server-side from the full ensemble. The answers
   * come back in `probabilities`, in the order given here.
   */
  readonly prob?: readonly ProbabilityTerm[];
  /** Window totals (storm totals) to compute server-side, answered in `windowTotals`. */
  readonly totals?: readonly TotalTerm[];
  /** Opt-in serve-path diagnostics. */
  readonly diagnostics?: readonly ('provenance' | 'ptype')[];
  /** Which "feels like" indices to serve. Default `['nws']`. */
  readonly feelsLike?: readonly ('nws' | 'utci')[];
}

/** Options for a named location's forecast. */
export interface LocationForecastOptions extends ForecastOptions {
  /** Extra elevations (ski areas): `'all'`, or the names to include. */
  readonly elevations?: 'all' | readonly string[];
}

/** Options for current conditions. */
export interface CurrentOptions extends RequestOptions {
  readonly units?: UnitSystem;
  readonly sources?: readonly string[];
  readonly excludeSources?: readonly string[];
  /** Opt-in sections: `nowcast_hours` adds the obs-blended band. */
  readonly include?: readonly 'nowcast_hours'[];
}

/** Options for nearby locations. */
export interface NearbyOptions extends RequestOptions {
  readonly units?: UnitSystem;
  /** Neighbours wanted (1..20). Default 3. */
  readonly limit?: number;
  /** Search radius in km (at most 100). Default 50. */
  readonly radiusKm?: number;
}

/** Options for search. */
export interface SearchOptions extends RequestOptions {
  readonly state?: string;
  readonly county?: string;
  readonly type?: string;
  /** Max hits (1..100). Default 20. */
  readonly limit?: number;
}

/** Options for the state location lists. */
export interface ListLocationsOptions extends RequestOptions {
  /** One state (USPS code or name); every state when absent. */
  readonly state?: string;
  readonly type?: LocationType;
  readonly units?: UnitSystem;
  /** Page size (1..5000). */
  readonly limit?: number;
  /** Start from this cursor. */
  readonly cursor?: string;
}

/** Options for the location catalog list. */
export interface ListCatalogLocationsOptions extends RequestOptions {
  /** ISO 3166-2 code, e.g. `US-OR`. */
  readonly admin1?: string;
  /** ISO 3166-1 alpha-2 code, e.g. `US`. */
  readonly country?: string;
  readonly type?: string;
  readonly template?: string;
  /** Page size (1..100). Default 20. */
  readonly limit?: number;
  readonly cursor?: string;
}

/** Options for the station catalog list. */
export interface ListCatalogStationsOptions extends RequestOptions {
  readonly admin1?: string;
  readonly country?: string;
  readonly network?: readonly string[];
  /** Stations having all of these capabilities. */
  readonly capability?: readonly string[];
  readonly status?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

/** Options for a catalog detail. */
export interface CatalogDetailOptions extends RequestOptions {
  readonly include?: readonly ('content' | 'template' | 'ads')[];
  /** BCP-47 locale for `content`. Default `en`. */
  readonly locale?: string;
}

/** Options for lists with only a size. */
export interface LimitOptions extends RequestOptions {
  readonly limit?: number;
}

interface ResolvedConfig {
  readonly apiKey: string | undefined;
  readonly baseUrl: string;
  readonly units: UnitSystem;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly cache: CacheStore | undefined;
  readonly sendKeyOnOpenRoutes: boolean;
  readonly fetch: FetchLike;
  readonly userAgent: string | undefined;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly options: ClientOptions;
}

function resolveConfig(options: ClientOptions, inheritedCache?: CacheStore): ResolvedConfig {
  const apiKey = options.apiKey === null ? undefined : (options.apiKey ?? readEnv('OUREA_API_KEY'));
  const baseUrl = (options.baseUrl ?? readEnv('OUREA_BASE_URL') ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      throw new Error(parsed.protocol);
  } catch {
    throw new UsageError(`baseUrl must be an http(s) URL; got '${baseUrl}'.`);
  }
  const units = options.units ?? 'metric';
  if (!UNIT_SYSTEMS.includes(units)) throw new UsageError(`Unknown unit system '${units}'.`);
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!(timeoutMs > 0)) throw new UsageError('timeoutMs must be positive.');
  const maxRetries = options.maxRetries ?? 2;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new UsageError('maxRetries must be a whole number, 0 or more.');
  }
  let cache: CacheStore | undefined;
  if (options.cache === false) cache = undefined;
  else if (options.cache === undefined || options.cache === true)
    cache = inheritedCache ?? new MemoryCache();
  else cache = options.cache;
  const globalFetch: FetchLike | undefined = (globalThis as { fetch?: FetchLike }).fetch;
  const fetchImpl = options.fetch ?? globalFetch;
  if (fetchImpl === undefined) {
    throw new UsageError('No global fetch in this runtime; pass one as the `fetch` option.');
  }
  const product = `ensemble-weather-typescript/${VERSION} (${runtimeToken()})`;
  const userAgent = isBrowser()
    ? undefined
    : options.userAgent === undefined
      ? product
      : `${product} ${options.userAgent}`;
  return {
    apiKey: apiKey === '' ? undefined : apiKey,
    baseUrl,
    units,
    timeoutMs,
    maxRetries,
    cache,
    sendKeyOnOpenRoutes: options.sendKeyOnOpenRoutes ?? false,
    fetch: (input, init) => fetchImpl(input, init),
    userAgent,
    logger: options.logger ?? console,
    clock: options.clock ?? systemClock,
    options,
  };
}

function locationPath(location: LocationId): string {
  let state: string;
  let slug: string;
  if (typeof location === 'string') {
    const parts = location.split('/');
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
      throw new UsageError(`A location is 'state/slug', with exactly one '/'; got '${location}'.`);
    }
    [state, slug] = parts as [string, string];
  } else {
    ({ state, slug } = location);
    if (state === '' || slug === '')
      throw new UsageError('A location needs both a state and a slug.');
  }
  return `/${encodeRfc3986(stateSegment(state))}/${encodeRfc3986(slug)}`;
}

function stateSegment(state: string): string {
  return /^[A-Za-z]{2}$/.test(state) ? state.toLowerCase() : state;
}

function runText(run: string | Date | undefined): string | undefined {
  if (run === undefined || typeof run === 'string') return run;
  return run.toISOString().replace('.000Z', 'Z');
}

function attachMeta<T extends object>(data: T, meta: ResponseMeta): Result<T> {
  Object.defineProperty(data, 'meta', { value: meta, enumerable: false });
  return data as Result<T>;
}

/** Puts server answers back in the caller's order, by their reference class. */
function reorder<T>(
  answers: readonly T[],
  callerKeys: readonly string[],
  keyOf: (answer: T) => string,
  what: string,
): T[] {
  const byKey = new Map<string, T>();
  for (const a of answers) byKey.set(keyOf(a), a);
  return callerKeys.map((key) => {
    const answer = byKey.get(key);
    if (answer === undefined) {
      throw new OureaError(
        'unknown',
        `The response has no ${what} for the term ${key.replaceAll('|', ':')}.`,
      );
    }
    return answer;
  });
}

// Set only for the synchronous duration of `withOptions`, so the new client
// shares the old one's cache store.
let inheritedCache: CacheStore | undefined;

/**
 * The Ourea probabilistic weather API.
 *
 * @example
 * ```ts
 * import { Ourea, atLeast, inches } from 'ensemble-weather';
 *
 * const ourea = new Ourea(); // anonymous unless OUREA_API_KEY is set
 * const forecast = await ourea.getForecast('or/mt-hood-meadows', {
 *   prob: [atLeast('snowfall', inches(6))],
 * });
 * ```
 */
export class Ourea {
  readonly #config: ResolvedConfig;
  readonly #transport: Transport;
  #rateLimit: RateLimit | undefined;

  constructor(options: ClientOptions = {}) {
    const inherited = inheritedCache;
    inheritedCache = undefined;
    this.#config = resolveConfig(options, inherited);
    this.#transport = new Transport(this.#config);
  }

  /** The base URL requests go to. */
  get baseUrl(): string {
    return this.#config.baseUrl;
  }

  /** The default unit system. */
  get units(): UnitSystem {
    return this.#config.units;
  }

  /** Whether an API key is configured (the key itself is never exposed). */
  get hasApiKey(): boolean {
    return this.#config.apiKey !== undefined;
  }

  /** The rate-limit state of the last response, when it carried one. */
  get rateLimit(): RateLimit | undefined {
    return this.#rateLimit;
  }

  /**
   * A new client with some settings changed. It shares this client's cache
   * unless `cache` is overridden (entries never mix across keys).
   *
   * @example
   * ```ts
   * const imperial = ourea.withOptions({ units: 'imperial' });
   * ```
   */
  withOptions(overrides: ClientOptions): Ourea {
    inheritedCache = this.#config.cache;
    try {
      return new Ourea({ ...this.#config.options, ...overrides });
    } finally {
      inheritedCache = undefined;
    }
  }

  /** Never prints the key. */
  toString(): string {
    return `Ourea(${this.#config.baseUrl}, ${this.hasApiKey ? 'with API key' : 'anonymous'})`;
  }

  /** @internal Node's `util.inspect`: the same redacted form. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }

  toJSON(): Record<string, unknown> {
    return { baseUrl: this.#config.baseUrl, units: this.#config.units, hasApiKey: this.hasApiKey };
  }

  async #get<T extends object>(
    operation: string,
    path: string,
    query: QueryBuilder,
    open: boolean,
    signal: AbortSignal | undefined,
  ): Promise<Result<T>> {
    const raw = await this.#transport.get({
      operation,
      path: `/api/v1${path}`,
      query: query.toString(),
      open,
      signal,
    });
    this.#rateLimit = raw.meta.rateLimit;
    const data = camelize(raw.data);
    if (typeof data !== 'object' || data === null) {
      throw new OureaError('unknown', `${operation}: the response body is not a JSON object.`);
    }
    return attachMeta(data as T, raw.meta);
  }

  #forecastQuery(options: LocationForecastOptions): {
    query: QueryBuilder;
    prob: readonly string[] | undefined;
    totals: readonly string[] | undefined;
  } {
    const units = options.units ?? this.#config.units;
    const prob =
      options.prob === undefined || options.prob.length === 0
        ? undefined
        : wireProbabilities(options.prob, units);
    const totals =
      options.totals === undefined || options.totals.length === 0
        ? undefined
        : wireTotals(options.totals);
    const feelsLike = options.feelsLike?.join(',');
    const query = new QueryBuilder()
      .set('units', units, 'metric')
      .set('max_hours', options.maxHours, 24)
      .set('include_past', options.includePast, false)
      .set('models', options.models, false)
      .set('members', options.members, false)
      .set('elevations', options.elevations === 'all' ? 'all' : options.elevations?.join(','))
      .set('daily', options.daily, true)
      .set('max_days', options.maxDays)
      .set('hourly', options.hourly, true)
      .set('run', runText(options.run))
      .list('sources', options.sources)
      .list('exclude_sources', options.excludeSources)
      .set('nowcast', options.nowcast, true)
      .raw('prob', prob?.query)
      .raw('totals', totals?.query)
      .list('diagnostics', options.diagnostics)
      .set('feels_like', feelsLike === '' ? undefined : feelsLike, 'nws');
    return { query, prob: prob?.callerKeys, totals: totals?.callerKeys };
  }

  async #forecast(
    operation: string,
    path: string,
    options: LocationForecastOptions,
    extra: (q: QueryBuilder) => void,
  ): Promise<Result<ForecastResponse>> {
    const { query, prob, totals } = this.#forecastQuery(options);
    extra(query);
    const result = await this.#get<ForecastResponse>(operation, path, query, false, options.signal);
    const answered = result as unknown as {
      probabilities?: ProbabilityResult[];
      windowTotals?: WindowTotal[];
    };
    // A body without the field answers nothing: it stays absent (never a
    // substituted value). A body with the field must answer every term.
    if (prob !== undefined && result.probabilities !== undefined) {
      answered.probabilities = reorder(
        result.probabilities,
        prob,
        (r) => probabilityResultKey(r, result.units),
        'probability',
      );
    }
    if (totals !== undefined && result.windowTotals !== undefined) {
      answered.windowTotals = reorder(result.windowTotals, totals, windowTotalKey, 'window total');
    }
    return result;
  }

  /**
   * The forecast for a named location (operation `getLocationForecast`).
   * Anonymous calls are fine (Free tier).
   */
  async getForecast(
    location: LocationId,
    options: LocationForecastOptions = {},
  ): Promise<Result<ForecastResponse>> {
    return await this.#forecast(
      'getLocationForecast',
      `/locations${locationPath(location)}`,
      options,
      () => undefined,
    );
  }

  /** The forecast at coordinates, with an optional elevation (operation `getPointForecast`; Pro). */
  async getPointForecast(
    point: PointWithElevation,
    options: ForecastOptions = {},
  ): Promise<Result<ForecastResponse>> {
    return await this.#forecast('getPointForecast', '/forecast', options, (q) => {
      q.set('lat', point.lat).set('lon', point.lon).set('elevation_m', point.elevationM);
    });
  }

  #currentQuery(options: CurrentOptions): QueryBuilder {
    return new QueryBuilder()
      .set('units', options.units ?? this.#config.units, 'metric')
      .list('sources', options.sources)
      .list('exclude_sources', options.excludeSources)
      .list('include', options.include);
  }

  /** Current conditions, sensors and alerts for a named location (operation `getCurrentConditions`). */
  async getCurrent(
    location: LocationId,
    options: CurrentOptions = {},
  ): Promise<Result<CurrentResponse>> {
    const path = `/locations${locationPath(location)}/current`;
    return await this.#get(
      'getCurrentConditions',
      path,
      this.#currentQuery(options),
      false,
      options.signal,
    );
  }

  /** Current conditions at coordinates (operation `getCurrentByCoordinates`). */
  async getCurrentAt(
    point: PointWithElevation,
    options: CurrentOptions = {},
  ): Promise<Result<CurrentResponse>> {
    const query = this.#currentQuery(options)
      .set('lat', point.lat)
      .set('lon', point.lon)
      .set('elevation_m', point.elevationM);
    return await this.#get('getCurrentByCoordinates', '/current', query, false, options.signal);
  }

  /** Active alerts for a named location (operation `getLocationAlerts`). */
  async getAlerts(
    location: LocationId,
    options: RequestOptions = {},
  ): Promise<Result<AlertsResponse>> {
    const path = `/locations${locationPath(location)}/alerts`;
    return await this.#get('getLocationAlerts', path, new QueryBuilder(), false, options.signal);
  }

  /** Active alerts at coordinates (operation `getAlertsByCoordinates`). */
  async getAlertsAt(
    point: Coordinates,
    options: RequestOptions = {},
  ): Promise<Result<AlertsResponse>> {
    const query = new QueryBuilder().set('lat', point.lat).set('lon', point.lon);
    return await this.#get('getAlertsByCoordinates', '/alerts', query, false, options.signal);
  }

  #nearbyQuery(options: NearbyOptions): QueryBuilder {
    return new QueryBuilder()
      .set('units', options.units ?? this.#config.units, 'metric')
      .set('limit', options.limit, 3)
      .set('radius_km', options.radiusKm, 50);
  }

  /** Locations near a named location (operation `getNearbyLocations`). */
  async getNearby(
    location: LocationId,
    options: NearbyOptions = {},
  ): Promise<Result<NearbyLocationsResponse>> {
    const path = `/locations${locationPath(location)}/nearby`;
    return await this.#get(
      'getNearbyLocations',
      path,
      this.#nearbyQuery(options),
      false,
      options.signal,
    );
  }

  /** Locations near coordinates (operation `getNearbyByCoordinates`). */
  async getNearbyAt(
    point: Coordinates,
    options: NearbyOptions = {},
  ): Promise<Result<NearbyPointResponse>> {
    const query = this.#nearbyQuery(options).set('lat', point.lat).set('lon', point.lon);
    return await this.#get('getNearbyByCoordinates', '/nearby', query, false, options.signal);
  }

  /**
   * Free-text location search (operation `searchLocations`). An open route:
   * sent without the API key so every caller shares one edge-cache entry.
   */
  async searchLocations(
    q: string,
    options: SearchOptions = {},
  ): Promise<Result<SearchLocationsResponse>> {
    const query = new QueryBuilder()
      .set('q', q)
      .set('state', options.state)
      .set('county', options.county)
      .set('type', options.type)
      .set('limit', options.limit, 20);
    return await this.#get('searchLocations', '/search/locations', query, true, options.signal);
  }

  /**
   * One state's locations, or every state's (operations `getLocations` and
   * `getAllLocations`). Await it for a page; `for await` it for every location.
   */
  listLocations(
    options: ListLocationsOptions = {},
  ): PageRequest<LocationsResponse, LocationSummary> {
    const { state } = options;
    const path =
      state === undefined ? '/locations' : `/locations/${encodeRfc3986(stateSegment(state))}`;
    const operation = state === undefined ? 'getAllLocations' : 'getLocations';
    return new PageRequest(
      (cursor) => {
        const query = new QueryBuilder()
          .set('type', options.type)
          .set('units', options.units ?? this.#config.units, 'metric')
          .set('limit', options.limit)
          .set('cursor', cursor);
        return this.#get<LocationsResponse>(operation, path, query, false, options.signal);
      },
      (page) => page.locations,
      (page) => page.nextCursor,
      options.cursor,
    );
  }

  /**
   * The location catalog (operation `listCatalogLocations`). Sent with the
   * key, so a keyed client keeps its own catalog budget.
   */
  listCatalogLocations(
    options: ListCatalogLocationsOptions = {},
  ): PageRequest<CatalogLocationPage, CatalogLocation> {
    return new PageRequest(
      (cursor) => {
        const query = new QueryBuilder()
          .set('admin1', options.admin1)
          .set('country', options.country)
          .set('type', options.type)
          .set('template', options.template)
          .set('limit', options.limit, 20)
          .set('cursor', cursor);
        return this.#get<CatalogLocationPage>(
          'listCatalogLocations',
          '/catalog/locations',
          query,
          false,
          options.signal,
        );
      },
      (page) => page.items,
      (page) => page.nextCursor,
      options.cursor,
    );
  }

  /** One catalog location (operation `getCatalogLocation`; open route, sent without the key). */
  async getCatalogLocation(
    slug: string,
    options: CatalogDetailOptions = {},
  ): Promise<Result<CatalogLocationDetail>> {
    const query = new QueryBuilder()
      .list('include', options.include)
      .set('locale', options.locale, 'en');
    return await this.#get(
      'getCatalogLocation',
      `/catalog/locations/${encodeRfc3986(slug)}`,
      query,
      true,
      options.signal,
    );
  }

  /** The station catalog (operation `listCatalogStations`). */
  listCatalogStations(
    options: ListCatalogStationsOptions = {},
  ): PageRequest<CatalogStationPage, CatalogStation> {
    return new PageRequest(
      (cursor) => {
        const query = new QueryBuilder()
          .set('admin1', options.admin1)
          .set('country', options.country)
          .list('network', options.network)
          .repeated('capability', options.capability)
          .set('status', options.status)
          .set('limit', options.limit, 20)
          .set('cursor', cursor);
        return this.#get<CatalogStationPage>(
          'listCatalogStations',
          '/catalog/stations',
          query,
          false,
          options.signal,
        );
      },
      (page) => page.items,
      (page) => page.nextCursor,
      options.cursor,
    );
  }

  /** One catalog station (operation `getCatalogStation`; open route). */
  async getCatalogStation(
    slug: string,
    options: CatalogDetailOptions = {},
  ): Promise<Result<CatalogStationDetail>> {
    const query = new QueryBuilder()
      .list('include', options.include)
      .set('locale', options.locale, 'en');
    return await this.#get(
      'getCatalogStation',
      `/catalog/stations/${encodeRfc3986(slug)}`,
      query,
      true,
      options.signal,
    );
  }

  /** The served model run and the available ones (operation `getAvailableRuns`). */
  async getRuns(options: LimitOptions = {}): Promise<Result<RunsResponse>> {
    const query = new QueryBuilder().set('limit', options.limit, 10);
    return await this.#get('getAvailableRuns', '/runs', query, false, options.signal);
  }

  /** Recent storm verification reports (operation `getStormReports`). */
  async getStormReports(options: LimitOptions = {}): Promise<Result<StormReportsResponse>> {
    const query = new QueryBuilder().set('limit', options.limit, 20);
    return await this.#get('getStormReports', '/storm-reports', query, false, options.signal);
  }

  /** One storm report (operation `getStormReport`). */
  async getStormReport(id: number, options: RequestOptions = {}): Promise<Result<StormReportCard>> {
    if (!Number.isInteger(id))
      throw new UsageError(`A storm report id is an integer; got ${String(id)}.`);
    return await this.#get(
      'getStormReport',
      `/storm-reports/${formatNumber(id)}`,
      new QueryBuilder(),
      false,
      options.signal,
    );
  }

  /** Every data source with its licence and required statements (operation `getAttribution`; open route). */
  async getAttribution(options: RequestOptions = {}): Promise<Result<AttributionRegistry>> {
    return await this.#get(
      'getAttribution',
      '/attribution',
      new QueryBuilder(),
      true,
      options.signal,
    );
  }
}
