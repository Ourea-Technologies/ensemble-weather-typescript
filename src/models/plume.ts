// SPDX-License-Identifier: BSD-2-Clause
// The plume view (`members: 'plume'`) and the forecast's added shapes.

import type { ElevationSummary, LocationRef, Open } from './common.js';
import type { SnowOutlookQuantiles } from './forecast.js';

/**
 * The forecast's `location` -- the one `LocationRef` (every field where it was) plus what a
 * forecast client labels and picks with, so the forecast body alone is enough to draw a plume
 * or a meteogram at a named elevation (no `/nearby` call, no client-side unit conversion).
 */
export interface ForecastLocation extends LocationRef {
  /**
   * `elevation_m` in the request's length units (m for `metric`/`kelvin`, ft for `imperial`),
   * to 0.1 -- the elevation `forecast.timeseries` (and its members) is served at.
   */
  readonly elevation: number;
  /**
   * The location's named elevations -- exactly the list its `/nearby` and list rows serve
   * (`LocationSummary.elevations`): the primary first and its ONE `default: true`, then each
   * other elevation (ski-area base / mid / ...
   */
  readonly elevations?: readonly ElevationSummary[];
}

/**
 * A distribution over the ensemble MEMBERS (`members_cumulative`, `members_spread`,
 * `members_6h`): the `Quantiles` shape.
 */
export interface MemberQuantiles {
  readonly mean: number;
  readonly p10: number;
  readonly p25: number;
  /** The members' median. */
  readonly p50?: number;
  readonly p75: number;
  readonly p90: number;
  readonly min: number;
  readonly max: number;
  /** As `Quantiles.probability`, where the use says. */
  readonly probability?: number;
}

/**
 * The members' spread at this hour for the plume's instantaneous variables -- the Quantiles of
 * every member's own `temperature` (temperature unit) and `snow_level` (length unit) here, over
 * the members as served.
 */
export interface MembersSpread {
  readonly temperature?: MemberQuantiles;
  readonly snowLevel?: MemberQuantiles;
  /**
   * The Quantiles of the members' own `snow_level_wet_bulb` (the snow level on the NWS scale),
   * over the members `snow_level` is over.
   */
  readonly snowLevelWetBulb?: MemberQuantiles;
  /**
   * The snow-to-liquid ratio over the members SNOWING at this hour (their own `snowfall` above
   * 0), at 00/06/12/18Z only, in both member views.
   */
  readonly slr?: MemberQuantiles;
  /** The members' own wind speed at this hour, in the wind unit. */
  readonly windSpeed?: MemberQuantiles;
}

/**
 * This hour's headline precipitation (`ensemble.precipitation.mean`) split by phase, in the
 * precipitation units -- `rain + snow + rain_snow_mix + freezing_rain` is the hour's mean (to
 * the served precision), so a stacked bar is the headline bar.
 */
export interface PrecipitationByType {
  readonly rain: number;
  /** The liquid that falls as snow (not snow depth; that is `ensemble.snowfall`). */
  readonly snow: number;
  readonly rainSnowMix: number;
  /** -- liquid that freezes on contact (counted in `rain` before). */
  readonly freezingRain: number;
}

/**
 * A day's snow level over its wet hours (m, or ft with `units=imperial`): the lowest and
 * highest hourly ensemble-mean snow level among them, and their precipitation-weighted mean.
 */
export interface SnowLevelRange {
  /** The lowest hourly snow level among the wet hours. */
  readonly low: number;
  /** The highest hourly snow level among the wet hours. */
  readonly high: number;
  /** The wet hours' snow level, weighted by their precipitation. */
  readonly mean: number;
}

/**
 * The day's climate normal at the forecast point: the mean, over the day of year +/-15 days of
 * every year of the station's record, of the very quantities this row states -- the local
 * CALENDAR date's maximum hourly temperature (`high`, the quantity `high` is), its minimum
 * (`low`) and its precipitation ...
 */
export interface DayNormal {
  /** Mean local-calendar-day maximum temperature. */
  readonly high?: number;
  /** Mean local-calendar-day minimum temperature. */
  readonly low?: number;
  /** Mean local-calendar-day precipitation total, dry days included. */
  readonly precipitation?: number;
  /** A climatology station's own record, or the ERA5 cell of the point. */
  readonly source: Open<'station' | 'era5_cell'>;
  /** Great-circle distance from the point to the station (or the cell centre), km. */
  readonly distanceKm: number;
}

/**
 * The served headline minus the normal, in the request's units: `high.p50 - normal.high` and
 * `low.p50 - normal.low`.
 */
export interface DayDeparture {
  readonly high?: number;
  readonly low?: number;
}

/**
 * How unusual the day is: where the served headline (`p50`) falls in the day's climatological
 * distribution, as a percentile 0-100, `Pr{climate <= forecast}` -- 95 for `precipitation`
 * reads "wetter than 95% of this date's days".
 */
export interface DayPercentile {
  readonly high?: number;
  readonly low?: number;
  readonly precipitation?: number;
}

/**
 * Rolling liquid-equivalent totals over the same windows as `snow_outlook`, for places where
 * rain is the story (the favorites cards' "0.6 in rain" with its range).
 */
export interface PrecipOutlook {
  /**
   * Sum of the hourly precipitation means over the 24 h from the first served hour; `null` when
   * not covered.
   */
  readonly next24h: number | null;
  /** The same over 48 h. */
  readonly next48h: number | null;
  /** The same over 72 h. */
  readonly next72h: number | null;
  /** The same over 168 h. */
  readonly next7d: number | null;
  readonly quantiles?: SnowOutlookQuantiles;
}

/** What the snowpack model states is on the ground at a spot at one hour. */
export interface SnowOnGround {
  /** Always `true` while the product is a beta; fields may be added. */
  readonly beta: boolean;
  /** Snow depth: cm, or in (imperial). */
  readonly depth: number;
  /** `measured`: the run started from a snow-depth sensor at the spot. */
  readonly basis: string;
  /**
   * The surface class at the hour; `/snowpack`'s `definitions.surface` carries the text of each
   * value (an open set).
   */
  readonly surface?: string;
  /** The hour the depth is for. */
  readonly validTime: string;
  /** When the snowpack run that produced it finished. */
  readonly generatedAt: string;
}

/**
 * The avalanche center's danger rating for the forecast zone the location's point is in, from
 * avalanche.org's public map layer.
 */
export interface AvalancheForecast {
  /** The avalanche center's short id. */
  readonly centerId: string;
  readonly centerName: string;
  /**
   * avalanche.org's id for the forecast zone; for a CAIC forecast area, an id at or above 2^52
   * derived from CAIC's area id (stable for that grouping of CAIC's polygons).
   */
  readonly zoneId: number;
  readonly zoneName: string;
  /**
   * The North American Public Avalanche Danger Scale level, 1-5; present only when `status` is
   * `rated`.
   */
  readonly dangerLevel: number | null;
  /**
   * Display text: the scale's English name for `danger_level` (Low, Moderate, Considerable,
   * High, Extreme), derived from the level, never the center's own wording; `null` exactly when
   * `danger_level` is.
   */
  readonly dangerLabel: string | null;
  /** `rated`: a current rating. */
  readonly status: Open<'rated' | 'no_rating' | 'off_season' | 'unavailable'>;
  /** When the center's current product took effect (UTC), when stated. */
  readonly validFrom: string | null;
  /** When the center's current product expires (UTC), when stated. */
  readonly validUntil: string | null;
  /** (JSON `forecast_url`) The center's full forecast for the zone. */
  readonly url: string;
  readonly centerUrl: string;
  /**
   * The credit to show with the block: "Avalanche forecast by <center> via avalanche.org", or
   * "Avalanche forecast by Colorado Avalanche Information Center via avalanche.state.co.us" for
   * a CAIC area.
   */
  readonly attribution: string;
}

/** One served series' members in columns (`members=plume`). */
export interface MemberPlume {
  readonly headline: PlumeHeadline;
  readonly bands: PlumeBands;
  /**
   * One entry per model with members in the served window, in the order aifs, aigefs, gefs,
   * ifs_ens, rrfs.
   */
  readonly models: readonly ModelColumns[];
  /** (JSON `members`) */
  readonly pool?: PooledColumns;
}

/**
 * The lines a plume draws over its members, at every served hour (`valid_time`): the blend's
 * `temperature` and `snow_level` means (`ensemble.*.mean`) and its running totals
 * (`cumulative_precipitation`, `cumulative_snowfall`: the "Ourea forecast" line), and that
 * snowfall line at a 10:1 snow-to-liquid ...
 */
export interface PlumeHeadline {
  readonly validTime: readonly string[];
  readonly temperature: readonly (number | null)[];
  readonly snowLevel: readonly (number | null)[];
  /**
   * The blend's snow level on the NWS scale (`ensemble.snow_level_wet_bulb.mean`, the height of
   * the 0.5 C wet-bulb); `snow_level` is the rain line.
   */
  readonly snowLevelWetBulb: readonly (number | null)[];
  readonly cumulativePrecipitation: readonly (number | null)[];
  /**
   * The hourly series' `cumulative_snowfall`: the running sum of the day cards' snowfall
   * (`daily[].precipitation_display.snow_amount`), spread inside each local date by the blend's
   * hourly mean snowfall, so at the end of ...
   */
  readonly cumulativeSnowfall: readonly (number | null)[];
  /**
   * The headline's running snowfall at a fixed 10:1 snow-to-liquid ratio, in the snowfall units
   * (in / mm), at the amount precision: each hour's served snowfall with its SLR
   * (`ensemble.slr.mean`) replaced by 10 -- the liquid ...
   */
  readonly cumulativeSnowfall10to1: readonly (number | null)[];
  /**
   * The forecast's hourly wind speed, the hourly series' `ensemble.wind_speed.mean`, in the
   * wind unit (mph / km/h / m/s as `units` says) at the wind precision (0.1), at every served
   * hour.
   */
  readonly windSpeed: readonly (number | null)[];
  /**
   * The forecast's snowfall in the 6 hours ending at each 00/06/12/18Z hour, in the snowfall
   * units (in / mm) at the amount precision: the rise of `cumulative_snowfall` over
   * `(valid_time - 6 h, valid_time]`, computed here so ...
   */
  readonly snowfall6h: readonly (number | null)[];
}

/**
 * The members' distributions, at the served hours that carry at least one (`valid_time`; the
 * synoptic hours in practice): `cumulative_precipitation` / `cumulative_snowfall` are the row
 * form's `members_cumulative` (the spread of the members' running totals, never a sum of hourly
 * percentiles), ...
 */
export interface PlumeBands {
  readonly validTime: readonly string[];
  readonly cumulativePrecipitation: BandColumns;
  readonly cumulativeSnowfall: BandColumns;
  /**
   * The members' running snowfall at 10:1 -- each member's snowfall with its SLR replaced by 10
   * (its snowing liquid x 10, every phase gate of its `snowfall` kept, the
   * `snowfall_total_10to1` map's member rule), totalled as ...
   */
  readonly cumulativeSnowfall10to1: BandColumns;
  readonly temperature: BandColumns;
  readonly snowLevel: BandColumns;
  /**
   * The row form's `members_spread.snow_level_wet_bulb` -- the members' snow level on the NWS
   * scale, at the hours `snow_level` carries a band.
   */
  readonly snowLevelWetBulb: BandColumns;
  readonly precipitation6h: BandColumns;
  readonly snowfall6h: BandColumns;
  readonly slr?: BandColumns;
  /** `members_spread.wind_speed`. */
  readonly windSpeed?: BandColumns;
}

/**
 * One band's statistics (Hyndman-Fan type 7 over the served member values), each an array
 * aligned to `PlumeBands.valid_time`, `null` where the band is absent at that hour.
 */
export interface BandColumns {
  readonly mean: readonly (number | null)[];
  readonly min: readonly (number | null)[];
  readonly p10: readonly (number | null)[];
  readonly p25: readonly (number | null)[];
  readonly p50?: readonly (number | null)[];
  readonly p75: readonly (number | null)[];
  readonly p90: readonly (number | null)[];
  readonly max: readonly (number | null)[];
}

/**
 * The members as ONE unlabelled pool, for a caller without the plume's paid detail (Free and
 * anonymous; `members_view: pool`).
 */
export interface PooledColumns {
  readonly validTime: readonly string[];
  readonly temperature: readonly (readonly (number | null)[])[];
  readonly precipitation: readonly (readonly (number | null)[])[];
  /**
   * `[member][step]`: the hours each `precipitation` and `snowfall` value covers: the grid step
   * (6), less where a member's first value covers less; `null` where the value is absent.
   */
  readonly precipitationHours: readonly (readonly (number | null)[])[];
  readonly cumulativePrecipitation: readonly (readonly (number | null)[])[];
  readonly snowLevel: readonly (readonly (number | null)[])[];
  readonly snowLevelWetBulb: readonly (readonly (number | null)[])[];
  readonly snowfall: readonly (readonly (number | null)[])[];
  readonly cumulativeSnowfall: readonly (readonly (number | null)[])[];
  readonly slr: readonly (readonly (number | null)[])[];
  /**
   * The rows (indices into every column) in `bands.cumulative_precipitation`'s fixed
   * population, ascending: that band's `mean` is the mean of these rows' running totals.
   */
  readonly cumulativePrecipitationBandMembers: readonly number[];
  /** Likewise for `bands.cumulative_snowfall`. */
  readonly cumulativeSnowfallBandMembers: readonly number[];
  /** Likewise for `bands.cumulative_snowfall_10to1`. */
  readonly cumulativeSnowfall10to1BandMembers: readonly number[];
}

/**
 * One model's members over its NATIVE steps inside the served window (`valid_time`: the hours
 * at which a member of the model carries a value -- every hour for RRFS, every sixth for the
 * global ensembles; never padded to the hourly series).
 */
export interface ModelColumns {
  readonly id: string;
  readonly validTime: readonly string[];
  /** The members, ascending (`MemberForecast.member_id`). */
  readonly memberIds: readonly number[];
  readonly temperature: readonly (readonly (number | null)[])[];
  readonly precipitation: readonly (readonly (number | null)[])[];
  /**
   * `[member][step]`: the hours each `precipitation` value covers; `null` where it is absent or
   * its span unknown.
   */
  readonly precipitationHours: readonly (readonly (number | null)[])[];
  readonly cumulativePrecipitation: readonly (readonly (number | null)[])[];
  readonly snowLevel: readonly (readonly (number | null)[])[];
  /**
   * `[Member][step]`, each member's `MemberForecast.snow_level_wet_bulb` (the snow level on the
   * NWS scale); `null` exactly where its `snow_level` is.
   */
  readonly snowLevelWetBulb: readonly (readonly (number | null)[])[];
  readonly snowfall: readonly (readonly (number | null)[])[];
  readonly cumulativeSnowfall: readonly (readonly (number | null)[])[];
  /**
   * One value per `valid_time` step (not per member): the median of the model's members'
   * `cumulative_snowfall` there (Hyndman-Fan type 7, as `bands`: the middle value, or the
   * midpoint of the two middle ones; a single-member ...
   */
  readonly cumulativeSnowfallP50: readonly (number | null)[];
  /**
   * As `cumulative_snowfall_p50`, over the members' running snowfall at 10:1 (see
   * `PlumeBands.cumulative_snowfall_10to1`).
   */
  readonly cumulativeSnowfall10to1P50: readonly (number | null)[];
  /** The model's mean lines. */
  readonly temperatureMean: readonly (number | null)[];
  /** The mean of `precipitation` (see `temperature_mean`). */
  readonly precipitationMean: readonly (number | null)[];
  /** The mean of `cumulative_precipitation` (see `temperature_mean`). */
  readonly cumulativePrecipitationMean: readonly (number | null)[];
  /** The mean of `snow_level` (see `temperature_mean`). */
  readonly snowLevelMean: readonly (number | null)[];
  /** The mean of `snow_level_wet_bulb` (see `temperature_mean`). */
  readonly snowLevelWetBulbMean: readonly (number | null)[];
  /** The mean of `snowfall` (see `temperature_mean`). */
  readonly snowfallMean: readonly (number | null)[];
  /**
   * The mean of `cumulative_snowfall` (see `temperature_mean`), beside its median
   * `cumulative_snowfall_p50`.
   */
  readonly cumulativeSnowfallMean: readonly (number | null)[];
  /**
   * The mean of the members' running snowfall at 10:1, beside `cumulative_snowfall_10to1_p50`
   * (the members' 10:1 column itself is not served).
   */
  readonly cumulativeSnowfall10to1Mean: readonly (number | null)[];
  /** The mean of `wind_speed` (see `temperature_mean`). */
  readonly windSpeedMean?: readonly (number | null)[];
  /** Which of this model's `member_ids` are in `bands.cumulative_precipitation`, ascending. */
  readonly cumulativePrecipitationBandMemberIds: readonly number[];
  /** As `cumulative_precipitation_band_member_ids`, for `bands.cumulative_snowfall`. */
  readonly cumulativeSnowfallBandMemberIds: readonly number[];
  /** As `cumulative_precipitation_band_member_ids`, for `bands.cumulative_snowfall_10to1`. */
  readonly cumulativeSnowfall10to1BandMemberIds: readonly number[];
  /** Pro (`members_view: full`) only; absent in the plume view. */
  readonly windSpeed?: readonly (readonly (number | null)[])[];
  /** Pro only; absent in the plume view. */
  readonly windDirection?: readonly (readonly (number | null)[])[];
  /** In both views. */
  readonly slr?: readonly (readonly (number | null)[])[];
}
