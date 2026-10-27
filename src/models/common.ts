// SPDX-License-Identifier: BSD-2-Clause
// Shapes shared across responses. Field names are the API's, in camelCase
// (`elevation_m` is `elevationM`); values are exactly what the server sent.

/**
 * An enum that may grow. Known values autocomplete; a value added to the API
 * after this SDK version arrives as its raw string and is never an error.
 */
export type Open<T extends string> = T | (string & Record<never, never>);

/** Location types the API knows today. */
export const LOCATION_TYPES = [
  'airport',
  'backcountry',
  'beach_coast',
  'campground',
  'city_town',
  'climbing_area',
  'coastal_point',
  'event_venue',
  'fire_lookout',
  'fishing_river_access',
  'golf_course',
  'hot_spring',
  'lake',
  'mountain_pass',
  'national_park',
  'observation_station',
  'other',
  'park',
  'recreation_area',
  'reservoir_lake',
  'scenic_tourist',
  'ski_area',
  'state_park',
  'summit',
  'trailhead',
  'volcano',
  'waterfall',
  'wine_agritourism',
] as const;

/** What kind of place a location is (`ski_area`, `summit`, ...). Open: see {@link Open}. */
export type LocationType = Open<(typeof LOCATION_TYPES)[number]>;

/**
 * Whether `value` is one of the `known` values this SDK version ships, as
 * opposed to a value added to the API later.
 *
 * @example
 * ```ts
 * if (!isKnown(LOCATION_TYPES, forecast.location.type)) console.log('new type', forecast.location.type);
 * ```
 */
export function isKnown<T extends string>(known: readonly T[], value: string): value is T {
  return (known as readonly string[]).includes(value);
}

/**
 * THE distribution shape: every ensemble statistic the API serves is one of
 * these, in the request's units. Every field is optional: a missing
 * percentile is absent, never 0.
 *
 * `wind_direction` quantiles are circular: `max` may be numerically less than
 * `min` (the arc wraps through north). The SDK does not "fix" that; use
 * {@link EnsembleStats.windDirectionCircular}.
 */
export interface Quantiles {
  /** Ensemble mean. For skewed amounts (precipitation, snowfall) prefer `p50` as a headline. */
  readonly mean?: number;
  /** 10th percentile. */
  readonly p10?: number;
  /** 25th percentile. */
  readonly p25?: number;
  /** Ensemble median. */
  readonly p50?: number;
  /** 75th percentile. */
  readonly p75?: number;
  /** 90th percentile. */
  readonly p90?: number;
  /** Ensemble minimum (often an outlier). */
  readonly min?: number;
  /** Ensemble maximum (often an outlier). */
  readonly max?: number;
  /** Hourly precipitation and snowfall only: the probability of occurrence (>= 0.1 mm), 0..1. */
  readonly probability?: number;
}

/** The location a forecast, current-conditions or alerts response is for. */
export interface LocationRef {
  readonly slug: string;
  /** Lowercase USPS state code. */
  readonly state: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  /** Elevation in metres, whatever the request's units. */
  readonly elevationM: number;
  readonly type: LocationType;
  /** IANA time zone, which the `daily` rows follow. */
  readonly timezone: string;
}

/** A named elevation of a location (ski areas: base, mid, summit). */
export interface LocationElevation {
  readonly name: string;
  readonly elevation: number;
  readonly default?: boolean;
}

/** A location in a list (state lists, nearby). */
export interface LocationSummary {
  readonly slug: string;
  readonly state: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly elevationM: number;
  readonly type: LocationType;
  readonly timezone: string;
  readonly county: string;
  readonly description?: string | null;
  readonly elevations?: readonly LocationElevation[];
}

/** The `attribution` block of a forecast, current-conditions or alerts response. */
export interface ResponseAttribution {
  /** Ids of exactly the data sources this response drew on. */
  readonly sources: readonly string[];
  /** The credit line to carry with redistributed output. */
  readonly credit: string;
  /** Where the full notices are. */
  readonly url: string;
}

/** One weather model of a run. */
export interface ModelEntry {
  readonly id: string;
  readonly cycle?: string;
  readonly members?: number;
}

/** An active weather alert (NWS). */
export interface ActiveAlert {
  readonly id: string;
  readonly event: string;
  readonly severity: string;
  readonly urgency: string;
  readonly headline: string;
  readonly onset?: string;
  readonly expires: string;
  readonly ends?: string;
}
