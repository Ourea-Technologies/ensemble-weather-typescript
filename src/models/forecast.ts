// SPDX-License-Identifier: BSD-2-Clause
// The forecast response (`getForecast`, `getPointForecast`).

import type {
  Aggregation,
  ComparisonOp,
  ProbabilityVariable,
  TotalVariable,
} from '../probability.js';
import type { UnitSystem } from '../units.js';
import type { LocationRef, ModelEntry, Open, Quantiles, ResponseAttribution } from './common.js';
import type { CurrentConditions } from './current.js';

/** A forecast for a named location or a point. */
export interface ForecastResponse {
  /** The thresholds behind the derived probability fields. */
  readonly thresholds?: ProbabilityThresholds;
  /**
   * The `prob` terms you asked for, answered by the server, **in the order you
   * gave them** (a duplicate term shares its result). Absent when none were asked.
   */
  readonly probabilities?: readonly ProbabilityResult[];
  /** The `totals` windows you asked for, in your order. Absent when none were asked. */
  readonly windowTotals?: readonly WindowTotal[];
  /** Options the server clamped to your tier. */
  readonly applied?: AppliedOptions;
  readonly location: LocationRef;
  readonly modelRun: ModelRunInfo;
  /** The unit system every value in this body is in. */
  readonly units: UnitSystem;
  readonly forecast: ForecastData;
  /** Extra elevations (ski areas), when asked for with `elevations`. */
  readonly elevationForecasts?: readonly ElevationForecast[];
  /** Whether the live nowcast layer is blended in. */
  readonly nowcastApplied: boolean;
  /** Nowcast sources this body was built without because they did not answer in time. */
  readonly nowcastUnavailable?: readonly Open<
    'observation' | 'radar' | 'cloud' | 'nearest_sensors'
  >[];
  /** Which member view `members` carries (`plume` for Free, `full` for Pro). */
  readonly membersView?: Open<'plume' | 'full'>;
  /** Columbia Gorge gap flow at the first served hour, where it applies. */
  readonly gapFlow?: GapFlow;
  readonly nearestSensors?: readonly NearestSensor[];
  /** For point forecasts: the point the request resolved to. */
  readonly point?: PointInfo;
  readonly current?: CurrentConditions;
  readonly attribution: ResponseAttribution;
}

/** Thresholds the derived probability fields use. */
export interface ProbabilityThresholds {
  readonly hourlyPrecipitation: number;
  readonly hourlySnowfall: number;
  readonly dailyPrecipitationProbability: number;
  readonly dailyPrecipitationOccurrenceProbability: number;
  readonly dailySnowProbability: number;
}

/** Why a probability or window total is `null`. */
export type NullReason = Open<'window_not_covered' | 'too_few_members' | 'variable_unavailable'>;

/**
 * One `prob` term, answered. It carries its whole reference class: the
 * variable, comparison, threshold, window and how many members voted.
 */
export interface ProbabilityResult {
  /** The term's canonical spelling, as sent: the key results are matched by. */
  readonly term: string;
  readonly variable: Open<ProbabilityVariable>;
  readonly op: Open<ComparisonOp>;
  /** In the request's units, at the variable's served precision. */
  readonly threshold: number;
  readonly windowStartHours: number;
  readonly windowEndHours: number;
  readonly aggregation: Open<Aggregation>;
  /** The window's first instant (ISO 8601), or `null` when not covered. */
  readonly from: string | null;
  /** The window's end, exclusive (ISO 8601), or `null` when not covered. */
  readonly to: string | null;
  /**
   * The share of members meeting the term, 0..1. `null` (see `nullReason`)
   * when it has no value: absent, never 0.
   */
  readonly probability: number | null;
  /** Members that voted. */
  readonly members: number;
  /** Why `probability` is `null`; `null` when it is not. */
  readonly nullReason: NullReason | null;
}

/** One `totals` window: the distribution of each member's total over it. */
export interface WindowTotal {
  /** The term's canonical spelling, as sent: the key results are matched by. */
  readonly term: string;
  readonly variable: Open<TotalVariable | 'temperature' | 'wind_speed'>;
  readonly windowStartHours: number;
  readonly windowEndHours: number;
  /** What each member contributes: `total` for precipitation and snowfall. */
  readonly aggregation: Open<'total' | 'min' | 'max'>;
  readonly from: string | null;
  readonly to: string | null;
  /** The members' window totals; `null` (see `nullReason`) when the window is not covered. */
  readonly quantiles: Quantiles | null;
  readonly members: number;
  /** Why `quantiles` is `null`; `null` when it is not. */
  readonly nullReason: NullReason | null;
}

/** Request options the server clamped. */
export interface AppliedOptions {
  readonly maxHours: number | null;
  readonly maxDays: number | null;
  readonly clamped: readonly Open<'max_hours' | 'max_days'>[];
}

/** The model run a forecast was built from. */
export interface ModelRunInfo {
  /** Initialization time (ISO 8601). */
  readonly initializedAt: string;
  readonly totalMembers: number;
  readonly models: readonly ModelEntry[];
}

/** Columbia Gorge gap flow status. */
export interface GapFlow {
  readonly status: Open<'none' | 'moderate' | 'strong' | 'extreme'>;
  readonly pressureDiffHpa: number;
  readonly windMultiplier: number;
  readonly direction: string;
}

/** A nearby observation sensor. */
export interface NearestSensor {
  readonly stationId: string;
  readonly name: string;
  readonly source: string;
  readonly distanceKm: number;
  readonly elevationDiff: number;
  readonly effectiveDistanceKm: number;
  readonly observationTime: string;
}

/** How a point forecast's coordinates resolved. */
export interface PointInfo {
  readonly requestedLat: number;
  readonly requestedLon: number;
  readonly lat: number;
  readonly lon: number;
  readonly resolutionDeg: number;
  readonly elevation: number;
  readonly elevationSource: Open<'request' | 'dem_3dep_10m'>;
  readonly state: string;
}

/** The hourly series, daily rows and snow outlook. */
export interface ForecastData {
  readonly maxHours: number;
  readonly intervalHours: number;
  /** The hourly series, starting at the current hour. Absent with `hourly: false`. */
  readonly timeseries?: readonly TimeSeriesPoint[];
  readonly daily?: readonly DailyForecast[];
  readonly snowOutlook?: SnowOutlook;
}

/** An hourly sky/weather condition. */
export type HourlyCondition = Open<
  | 'sunny'
  | 'mostly_sunny'
  | 'partly_cloudy'
  | 'mostly_cloudy'
  | 'cloudy'
  | 'clear'
  | 'mostly_clear'
  | 'slight_chance_showers'
  | 'chance_showers'
  | 'showers_likely'
  | 'rain'
  | 'light_rain'
  | 'heavy_rain'
  | 'slight_chance_rain_snow_mix'
  | 'chance_rain_snow_mix'
  | 'rain_snow_mix_likely'
  | 'rain_snow_mix'
  | 'slight_chance_snow'
  | 'chance_snow'
  | 'snow_likely'
  | 'snow'
  | 'slight_chance_freezing_rain'
  | 'chance_freezing_rain'
  | 'freezing_rain_likely'
  | 'freezing_rain'
>;

/** A forecast variable named in provenance tags. */
export type ProvenanceVariable = Open<
  | 'temperature'
  | 'dewpoint'
  | 'precipitation'
  | 'snowfall'
  | 'wind_speed'
  | 'wind_gust'
  | 'snow_level'
  | 'cloud_cover'
>;

/** One hour of the forecast. */
export interface TimeSeriesPoint {
  /** The hour (ISO 8601). */
  readonly validTime: string;
  readonly leadTimeHours: number;
  readonly isNight: boolean;
  readonly condition: HourlyCondition;
  /** Display text for `condition` ("Partly Cloudy"). */
  readonly conditionText: string;
  /** Icon name for `condition` (day and night variants). */
  readonly conditionIcon: ConditionIcon;
  readonly gustNotable?: boolean;
  readonly precipitationType?: PrecipType;
  readonly inversion?: InversionInfo;
  readonly freezingLevel?: FreezingLevel;
  /** The full distribution of every variable this hour. */
  readonly ensemble: EnsembleStats;
  /** Post-processing tags (with `diagnostics: ['provenance']`). */
  readonly provenance?: HourProvenance;
  /** Per-model statistics (Pro, with `models: true`). */
  readonly modelMeans?: ModelMeans;
  /** Individual member values (with `members: true`). */
  readonly members?: readonly ModelMembers[];
  readonly membersCumulative?: MembersCumulative;
  readonly cumulativePrecipitation?: number;
  readonly cumulativeSnowfall?: number;
}

/** The ensemble distribution of each variable at one hour. */
export interface EnsembleStats {
  readonly temperature: Quantiles;
  readonly feelsLike?: Quantiles;
  readonly dewpoint: Quantiles | null;
  readonly precipitation: Quantiles;
  readonly windSpeed: Quantiles;
  readonly windGust?: Quantiles;
  /**
   * Circular, so not a {@link Quantiles}: each sector runs clockwise from
   * `from` to `to`, and `to` may be numerically less than `from`.
   */
  readonly windDirection: CircularStats;
  readonly snowLevel: Quantiles | null;
  readonly slr?: Quantiles;
  readonly snowfall?: Quantiles;
  readonly cloudCover?: Quantiles;
  /** With `include: ['skin_temperature']`. */
  readonly skinTemperature?: Quantiles;
  /** With `include: ['mslp']`. */
  readonly mslp?: Quantiles;
  readonly cape?: Quantiles;
  readonly relativeHumidity?: Quantiles;
}

/** A bearing's distribution on the circle, in degrees. */
export interface CircularStats {
  readonly mean: number;
  readonly stddev?: number;
  /** The central 50 % of members, as a clockwise arc. */
  readonly sector50: Sector;
  /** The central 90 % of members, as a clockwise arc. */
  readonly sector90: Sector;
}

/** A clockwise arc of bearings. */
export interface Sector {
  readonly from: number;
  readonly to: number;
}

/** The likely precipitation type this hour. */
export interface PrecipType {
  readonly type: Open<'rain' | 'snow' | 'rain_snow_mix' | 'freezing_rain'>;
  readonly snowProbability: number;
  readonly rainProbability: number;
}

/** A temperature inversion this hour. */
export interface InversionInfo {
  readonly kind: Open<'surface_shallow' | 'cold_pool' | 'elevated'>;
  readonly depth: number;
  readonly strength: number;
}

/** The freezing level: below the surface, at a height, or above the profile. */
export type FreezingLevel =
  FreezingLevelBelowSurface | FreezingLevelHeight | FreezingLevelAboveProfile;

/** The whole column is below freezing. */
export interface FreezingLevelBelowSurface {
  readonly kind: 'below_surface';
}

/** The freezing level's height. */
export interface FreezingLevelHeight {
  readonly kind: 'height';
  readonly height: number;
  readonly aboveFreezingLayerAloft: boolean;
}

/** The whole profile is above freezing, up to `top`. */
export interface FreezingLevelAboveProfile {
  readonly kind: 'above_profile';
  readonly top: number;
}

/** Which post-processing rule shaped each variable this hour. */
export interface HourProvenance {
  readonly densified?: boolean;
  readonly ngr?: readonly ProvenanceVariable[];
  readonly fallback?: readonly ProvenanceVariable[];
  readonly borrowed?: readonly ProvenanceVariable[];
  readonly spreadFloored?: readonly ProvenanceVariable[];
  readonly floorClamped?: readonly ProvenanceVariable[];
  readonly bucketSplit?: readonly ProvenanceVariable[];
  readonly distributionParameters?: readonly ProvenanceVariable[];
  readonly spreadInterpolated?: readonly ProvenanceVariable[];
  readonly interpolatedContributor?: readonly ProvenanceVariable[];
  readonly momentMatchedFamily?: readonly ProvenanceVariable[];
  readonly lapseProfile?: readonly ProvenanceVariable[];
  readonly lapseClimatology?: readonly ProvenanceVariable[];
  readonly lapsePrism?: readonly ProvenanceVariable[];
  readonly spreadClampedLow?: readonly ProvenanceVariable[];
  readonly spreadClampedHigh?: readonly ProvenanceVariable[];
  readonly gustDressed?: readonly ProvenanceVariable[];
}

/** Per-model statistics at one hour, in `modelRun.models` order. */
export type ModelMeans = readonly ModelMean[];

/** One model's statistics at one hour. */
export interface ModelMean extends ModelStats {
  readonly id: string;
}

/** One model's distribution of each variable. */
export interface ModelStats {
  readonly temperature?: Quantiles;
  readonly dewpoint?: Quantiles;
  readonly precipitation?: Quantiles;
  readonly windSpeed?: Quantiles;
  /** Circular: see {@link EnsembleStats.windDirection}. */
  readonly windDirection?: CircularStats;
  readonly snowLevel?: Quantiles;
  readonly slr?: Quantiles;
  readonly snowfall?: Quantiles;
  readonly interpolated?: boolean;
}

/** One model's members at one hour. */
export interface ModelMembers {
  readonly id: string;
  readonly members: readonly MemberForecast[];
}

/** One ensemble member's values at one hour. */
export interface MemberForecast {
  readonly memberId: number;
  /** `null` when this member published nothing at this hour. */
  readonly temperature: number | null;
  readonly precipitation: number | null;
  readonly precipitationHours?: number;
  readonly windSpeed?: number | null;
  readonly windDirection?: number | null;
  readonly snowLevel: number | null;
  readonly slr?: number;
  readonly snowfall?: number;
  readonly cumulativePrecipitation?: number;
  readonly cumulativeSnowfall?: number;
}

/** The distribution of the members' running totals at a synoptic hour. */
export interface MembersCumulative {
  readonly precipitation?: Quantiles;
  readonly snowfall?: Quantiles;
}

/** An icon name for a condition (day and night variants). */
export type ConditionIcon = Open<
  | 'sunny'
  | 'mostly_sunny'
  | 'partly_cloudy'
  | 'mostly_cloudy'
  | 'cloudy'
  | 'sun_chance_showers'
  | 'sun_showers_likely'
  | 'sun_showers'
  | 'chance_showers'
  | 'chance_rain'
  | 'showers_likely'
  | 'rain_likely'
  | 'showers'
  | 'light_rain'
  | 'rain'
  | 'heavy_rain'
  | 'rain_snow_mix'
  | 'snow'
  | 'freezing_rain'
  | 'night_clear'
  | 'night_mostly_clear'
  | 'night_partly_cloudy'
  | 'night_mostly_cloudy'
  | 'night_cloudy'
  | 'night_moon_chance_showers'
  | 'night_moon_showers_likely'
  | 'night_moon_showers'
  | 'night_chance_showers'
  | 'night_chance_rain'
  | 'night_showers_likely'
  | 'night_rain_likely'
  | 'night_showers'
  | 'night_light_rain'
  | 'night_rain'
  | 'night_heavy_rain'
  | 'night_rain_snow_mix'
  | 'night_snow'
  | 'night_freezing_rain'
>;

/** A daily condition. */
export type DailyCondition = Open<
  | 'sunny'
  | 'mostly_sunny'
  | 'partly_cloudy'
  | 'mostly_cloudy'
  | 'cloudy'
  | 'slight_chance_showers'
  | 'chance_showers'
  | 'chance_rain'
  | 'showers_likely'
  | 'rain_likely'
  | 'showers'
  | 'rain'
  | 'slight_chance_rain_snow_mix'
  | 'chance_rain_snow_mix'
  | 'rain_snow_mix_likely'
  | 'rain_snow_mix'
  | 'slight_chance_snow'
  | 'chance_snow'
  | 'snow_likely'
  | 'snow'
>;

/** One local day. */
export interface DailyForecast {
  /** The local date (YYYY-MM-DD) in `location.timezone`. */
  readonly date: string;
  readonly condition: DailyCondition;
  readonly conditionText: string;
  readonly conditionIcon: ConditionIcon;
  readonly precipitationType?: Open<'rain' | 'snow' | 'rain_snow_mix' | 'freezing_rain'>;
  readonly high: Quantiles;
  readonly low: Quantiles;
  readonly feelsLikeHigh?: Quantiles;
  readonly feelsLikeLow?: Quantiles;
  /** The distribution of each member's own day total. */
  readonly totalPrecipitation: Quantiles;
  readonly totalSnowfall?: Quantiles;
  readonly precipitationProbability: number;
  readonly precipitationOccurrenceProbability: number;
  readonly snowProbability: number;
  readonly snowLevelMean: number | null;
  readonly snowLevel?: Quantiles;
  readonly totalPrecipitationIfWet?: Quantiles;
  readonly totalSnowfallIfWet?: Quantiles;
  readonly precipitationDisplay: PrecipDisplay;
  readonly cloudCoverMean?: number;
  readonly wind?: DailyWind;
  readonly stormOrientation?: Open<'right_side_up' | 'upside_down' | 'mixed'>;
  readonly stormOrientationDescription?: string;
  readonly astro: DailyAstro;
  readonly temperatureClimatology?: DayClimatology;
}

/** The day's wind summary. */
export interface DailyWind {
  readonly status: Open<'calm' | 'light' | 'moderate' | 'strong' | 'very_strong' | 'extreme'>;
  readonly peakSpeed: number;
  readonly peakSpeedP90?: number;
  readonly isGust: boolean;
  readonly sustainedSpeed?: number;
}

/** What a day's precipitation chip shows. */
export interface PrecipDisplay {
  readonly kind: Open<'none' | 'rain' | 'snow' | 'rain_snow_mix' | 'freezing_rain'>;
  readonly chance: number;
  readonly amount?: number;
}

/** Sun and moon for a day. */
export interface DailyAstro {
  readonly sunrise?: string;
  readonly sunset?: string;
  readonly moonPhase: Open<
    | 'new_moon'
    | 'waxing_crescent'
    | 'first_quarter'
    | 'waxing_gibbous'
    | 'full_moon'
    | 'waning_gibbous'
    | 'last_quarter'
    | 'waning_crescent'
  >;
  readonly moonIllumination: number;
  readonly astronomicalSeason: Open<'spring' | 'summer' | 'autumn' | 'winter'>;
}

/** A day's temperature climatology. */
export interface DayClimatology {
  readonly mean: number;
  readonly std: number;
}

/** Snow totals for common windows, computed by the server. */
export interface SnowOutlook {
  readonly next24h: number | null;
  readonly next48h: number | null;
  readonly next7d: number | null;
  readonly overnight4pm9am?: number;
  /** The distribution of each member's own window total. */
  readonly quantiles?: SnowOutlookQuantiles;
}

/** Window-total distributions for the snow outlook windows. */
export interface SnowOutlookQuantiles {
  readonly next24h: Quantiles | null;
  readonly next48h: Quantiles | null;
  readonly next7d: Quantiles | null;
}

/** A forecast at one extra elevation of a location. */
export interface ElevationForecast {
  readonly name: string;
  readonly elevation: number;
  readonly lat: number;
  readonly lon: number;
  readonly hourly?: readonly TimeSeriesPoint[];
  readonly daily?: readonly DailyForecast[];
  readonly snowOutlook?: SnowOutlook;
}
