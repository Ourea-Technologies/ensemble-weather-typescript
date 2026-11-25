// SPDX-License-Identifier: BSD-2-Clause
// Rankings, the blend's composition, the season to date and the snow trend.

import type { UnitSystem } from '../units.js';
import type { LocationRef, ModelEntry, Open, ResponseAttribution } from './common.js';

/** One page of a ranking. */
export interface ExploreResponse {
  readonly metric: Open<
    | 'base_depth'
    | 'new_snow_24h'
    | 'snow_today'
    | 'snow_5d'
    | 'snow_10d'
    | 'snow_14d'
    | 'precip_today'
    | 'precip_5d'
    | 'precip_10d'
    | 'precip_14d'
    | 'season_precip'
    | 'season_precip_pct_normal'
    | 'season_snow'
  >;
  readonly order: Open<'desc' | 'asc'>;
  readonly units: UnitSystem;
  /** The unit of every `value`, `p10` and `p90`. */
  readonly unit: Open<'mm' | 'cm' | 'in' | 'percent'>;
  readonly items: readonly ExploreItem[];
  /** Items on this page. */
  readonly count: number;
  /** Pass as `?cursor=` (same other parameters) for the next page; null at the end. */
  readonly nextCursor: string | null;
}

/** One ranked point of a place. */
export interface ExploreItem {
  /** 1-based, across pages. */
  readonly rank: number;
  readonly location: LocationRef;
  /** The named elevation; `null` = the place's own point. */
  readonly elevationName: string | null;
  /**
   * What the elevation `elevation_name` is called, as `ElevationSummary.display_name`; absent
   * where it has no name.
   */
  readonly elevationDisplayName?: string;
  /** The point's elevation, m or ft by `units`. */
  readonly elevation: number;
  /** The metric's value as the place's page serves it, in `unit`. */
  readonly value: number;
  /**
   * Present only on `snow_today` (the day's served `total_snowfall.p10`, where it has a
   * `snow_amount`) and `precip_today` (`total_precipitation_if_wet.p10`, where the day is not
   * `none`).
   */
  readonly p10?: number;
  /** As `p10`. */
  readonly p90?: number;
  /**
   * When the value was taken: the forecast windows when recorded from the served run,
   * `base_depth` its hour, `new_snow_24h` the snowpack run's first hour, the season its newest
   * computed day.
   */
  readonly asOf: string;
  /** Forecast windows only, the served run's `model_run.initialized_at`. */
  readonly initializedAt: string | null;
  readonly source: Open<
    'ourea' | 'snowpack_measured' | 'snowpack_open_loop' | 'mrms_multisensor' | 'station_gauge'
  >;
  /** With `near` only, from it (0.1 km). */
  readonly distanceKm?: number;
  /** The place's forecast route; add `?elevations=<elevation_name>` for a named point. */
  readonly path: string;
}

/** A search hit's Explore value; the fields mean what an `ExploreItem`'s do. */
export interface ExploreValue {
  readonly metric: Open<
    | 'base_depth'
    | 'new_snow_24h'
    | 'snow_today'
    | 'snow_5d'
    | 'snow_10d'
    | 'snow_14d'
    | 'precip_today'
    | 'precip_5d'
    | 'precip_10d'
    | 'precip_14d'
    | 'season_precip'
    | 'season_precip_pct_normal'
    | 'season_snow'
  >;
  readonly value: number;
  readonly unit: Open<'mm' | 'cm' | 'in' | 'percent'>;
  readonly p10?: number;
  readonly p90?: number;
  readonly asOf: string;
  readonly initializedAt: string | null;
  readonly source: string;
}

/** `GET /api/v1/composition`. */
export interface CompositionResponse {
  /** The reference init: the newest contributing cycle, a forecast's `model_run.initialized_at`. */
  readonly initializedAt: string;
  /**
   * Each contributing model, its own cycle and its members (`members` absent only when the
   * cycle's member count is not known).
   */
  readonly models: readonly ModelEntry[];
  /** Entries in `models`. */
  readonly modelCount: number;
  /** The sum of `models[].members`: the members the blend draws on. */
  readonly totalMembers: number;
}

/** -- observed season-to-date precipitation at a location. */
export interface SeasonResponse {
  readonly location: LocationRef;
  /** The water year by its ending year. */
  readonly waterYear: number;
  /** The first local day of the water year. */
  readonly starts: string;
  /** The last local day with an observed row (the day before `starts` when there is none). */
  readonly through: string;
  /** When the newest day row was computed; null with no rows. */
  readonly asOf: string | null;
  readonly units: UnitSystem;
  /** Null until the location has an observed day. */
  readonly precipitation: SeasonTotal | null;
  /** Always null for now; season snowfall is not served yet. */
  readonly snowfall: SeasonTotal | null;
  /** The nearest SNOTEL or SCAN gauge within 25 km and 300 m with rows this water year, or null. */
  readonly station: SeasonStation | null;
  /** Only with `include=daily`. */
  readonly daily?: readonly SeasonDay[];
  readonly attribution: ResponseAttribution;
}

/** The `SeasonTotal` shape. */
export interface SeasonTotal {
  /** Sum over the covered days, in `unit`. */
  readonly total: number;
  readonly unit: Open<'mm' | 'cm' | 'in'>;
  /**
   * `mrms_multisensor`: the gridded analysis at the location; `station_gauge`: the location is
   * a gauge site and this is the gauge's accumulator.
   */
  readonly source: Open<'mrms_multisensor' | 'nohrsc_nsa' | 'station_gauge'>;
  readonly daysCovered: number;
  /** Days since `starts` with no complete observation; not counted as dry. */
  readonly daysMissing: number;
  /** Covered days still inside the 7-day restate window. */
  readonly provisionalDays: number;
  /** PRISM 1991-2020 over the covered days, in `unit`; null where no normal is loaded. */
  readonly normalToDate: number | null;
  readonly percentOfNormal: number | null;
  readonly normalSource: Open<'prism_1991_2020'> | null;
}

/** The `SeasonStation` shape. */
export interface SeasonStation {
  /** The NRCS station triplet. */
  readonly id: string;
  readonly network: Open<'snotel' | 'scan'>;
  readonly name: string;
  readonly distanceKm: number;
  readonly elevationM: number;
  /** The gauge's water-year accumulator on `through` (mm or in). */
  readonly precipitationTotal: number | null;
  readonly precipitationPercentOfMedian: number | null;
  /** Snow water equivalent on `through` (mm or in). */
  readonly swe: number | null;
  readonly swePercentOfMedian: number | null;
  /** Snow depth on `through` (cm or in). */
  readonly snowDepth: number | null;
  /** The gauge's newest day. */
  readonly through: string;
}

/** The `SeasonDay` shape. */
export interface SeasonDay {
  readonly date: string;
  /** The day's total; null when an hour was not observed. */
  readonly precipitation: number | null;
  /** Always null for now. */
  readonly snowfall: number | null;
  readonly provisional: boolean;
}

/** -- each recent run's daily snowfall at a location's point, by source. */
export interface SnowTrendResponse {
  readonly location: LocationRef;
  readonly units: UnitSystem;
  /** The point the grids are for. */
  readonly elevation: SnowTrendResponseElevation;
  /** How many days back runs are kept. */
  readonly retentionDays: number;
  /** The columns, location-local dates ascending. */
  readonly dates: readonly string[];
  /**
   * `ourea` first; with the `model_data` entitlement then `aifs`, `aigefs`, `gefs`, `ifs_ens`
   * and `rrfs`.
   */
  readonly grids: readonly SnowTrendGrid[];
}

/** The point the grids are for. */
export interface SnowTrendResponseElevation {
  /** The named elevation; `null` for a location with one point. */
  readonly name: string | null;
  /**
   * What that elevation is called, as `ElevationSummary.display_name`; absent where it has no
   * name.
   */
  readonly displayName?: string;
  /** Its elevation, in m (metric) or ft (imperial). */
  readonly elevation: number;
}

/** The `SnowTrendGrid` shape. */
export interface SnowTrendGrid {
  /** `ourea`, or a model id. */
  readonly source: string;
  /** Oldest first; the last is the newest. */
  readonly runs: readonly SnowTrendRun[];
}

/** The `SnowTrendRun` shape. */
export interface SnowTrendRun {
  /**
   * `true`: re-rendered after the fact from the pinned run (`?run=<initialized_at>`) by the
   * post-deploy backfill -- today's calibration and no live nowcast, so it can differ slightly
   * from what was served then.
   */
  readonly backfilled: boolean;
  /** `ourea`: the served body's `model_run.initialized_at`. */
  readonly initializedAt: string;
  /** One entry per `dates` entry, in order; `null` where the run has no value. */
  readonly days: readonly (SnowTrendDay | null)[];
}

/** The `SnowTrendDay` shape. */
export interface SnowTrendDay {
  /** The `dates` entry this day is for. */
  readonly date: string;
  /** The day's snowfall in mm (metric) or inches (imperial), at the served amount precision. */
  readonly snow: number | null;
  /** The run covers only part of this local day. */
  readonly partial: boolean;
  /** The range's low end. */
  readonly p10?: number;
  /** The range's high end, as `p10`. */
  readonly p90?: number;
  /** `ourea` only: the day's `precipitation_display.kind`. */
  readonly kind?: Open<'none' | 'rain' | 'snow' | 'rain_snow_mix' | 'freezing_rain'>;
}
