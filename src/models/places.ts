// SPDX-License-Identifier: BSD-2-Clause
// A place's summary and a mountain pass's forecast (on `getCurrent`).

import type { Open } from './common.js';

/** A mountain pass's official road status, least to most restrictive. */
export type PassStatusLevel = Open<
  'none' | 'advisory' | 'traction' | 'r1' | 'r2' | 'r3' | 'chains' | 'closed'
>;

/**
 * A short plain-language summary of what is coming at a place, written by the server from
 * templates filled with served values (never free text from a model).
 */
export interface PlaceSummary {
  /**
   * One sentence: the most important thing at the place, by priority (an NWS alert,
   * precipitation starting or stopping soon, snow coming, wind or a large temperature change,
   * then the day's headline).
   */
  readonly short: string;
  /** One to three sentences for the location page, each from a different kind of event. */
  readonly long: readonly string[];
  /**
   * The event behind each sentence of `long`, in the same order (`events[i]` wrote `long[i]`),
   * so a client can style a sentence (an alert chip, a snow icon) without parsing text.
   */
  readonly events: readonly SummaryEvent[];
  /**
   * The served elevation the sentences describe: its display name where the catalog has one,
   * else its name.
   */
  readonly elevationName?: string;
  /** The height the sentences describe, in the response's length units (m, ft). */
  readonly elevation: number;
  /** The init of the forecast run the sentences were written from. */
  readonly run: string;
  /** When the sentences were written (the request's now); the "updated" stamp. */
  readonly generatedAt: string;
}

/** The `SummaryEvent` shape. */
export interface SummaryEvent {
  /** What the sentence is about. */
  readonly kind: Open<
    | 'alert'
    | 'precip_starting'
    | 'precip_stopping'
    | 'snow_coming'
    | 'wind'
    | 'temperature_change'
    | 'day_headline'
    | 'pass_snow_starts'
    | 'pass_rain_to_snow'
    | 'pass_freezing_on_wet_road'
  >;
  /**
   * The phrasing used, `<template>.<variant>` (`snow_coming.v1.3`), stable across releases so
   * sentences can be counted, reviewed and later translated.
   */
  readonly template: string;
  /**
   * The hour the event begins (precipitation starting or stopping, an alert's onset, a pass
   * event).
   */
  readonly at?: string;
  /** When the event ends, where the sentence says so (an alert's end, a snow window's end). */
  readonly until?: string;
  /** The `alerts[].id` an `alert` event states. */
  readonly alertId?: string;
  /** The served numbers the sentence states, unrounded, in the response's units. */
  readonly values?: SummaryValues;
}

/** Each number a summary sentence states, as served. */
export interface SummaryValues {
  /**
   * The window's headline snowfall total (mm, in): for `snow_coming` the forecast's
   * `snow_outlook.<snowfall_window>`; for `pass_snow_starts` the window's
   * `pass.snow_windows[].total`.
   */
  readonly snowfall?: number;
  /**
   * The window's served p10 (`snow_outlook.quantiles.<window>.p10`, or the pass window's
   * `p10`).
   */
  readonly snowfallP10?: number;
  /** The window's served p90. */
  readonly snowfallP90?: number;
  /** Which window `snowfall` totals. */
  readonly snowfallWindow?: Open<'next_24h' | 'next_48h' | 'next_7d' | 'pass_snow_window'>;
  /** A day's served high (`daily[].high.mean`) a `day_headline` or `temperature_change` states. */
  readonly temperature?: number;
  /** The served hourly gust mean (`ensemble.wind_gust.mean`) a `wind` sentence states. */
  readonly windGust?: number;
  /** The served chance (0-1) behind the sentence's likelihood word. */
  readonly precipitationProbability?: number;
}

/**
 * "Is the pass getting weather?" at the pass's own point and elevation: forecast quantities
 * only, in the response's units.
 */
export interface PassForecast {
  /** The pass's elevation, in the response's length units (m, ft). */
  readonly elevation: number;
  /** The pass's elevation in metres, whatever `units` is. */
  readonly elevationM: number;
  /** The first hour of `hours` (the hour containing now); the 24 h and 48 h windows open here. */
  readonly from: string;
  readonly snow24h: PassSnow24h;
  readonly chances: PassChances;
  /** Each spell of snow at the pass in the next 48 h, in time order; empty when none. */
  readonly snowWindows: readonly PassSnowWindow[];
  /** The next 48 hours at the pass, from `from`, one per hour. */
  readonly hours: readonly PassHour[];
  readonly windows: PassTravelWindows;
  readonly officialStatus?: PassOfficialStatus;
  /**
   * The state DOT road-weather stations nearest the pass, nearest first: at most 3, within 25
   * km, each with its newest reading in the last 3 h.
   */
  readonly roadSensors?: readonly PassRoadSensor[];
  /** The DOT's own cameras at the pass, in the order the pass's curation lists them. */
  readonly cameras?: readonly PassCamera[];
}

/**
 * The next 24 h of snow at the pass: exactly the default forecast's own `snow_outlook.next_24h`
 * and `snow_outlook.quantiles.next_24h` (unpinned, the nowcast on, the same cycle), so the pass
 * page, the passes board and search state one number.
 */
export interface PassSnow24h {
  /** `snow_outlook.next_24h` (mm, in); null where the forecast does not reach 24 h. */
  readonly total: number | null;
  /** `snow_outlook.quantiles.next_24h.p10`; null without members covering the window. */
  readonly p10: number | null;
  /** `snow_outlook.quantiles.next_24h.p90`. */
  readonly p90: number | null;
  /**
   * The start of the first snow spell (`snow_windows[0].start`) when it begins inside the 24 h;
   * null otherwise.
   */
  readonly startsAt: string | null;
}

/**
 * Chances at the pass over the next `window_hours` hours, each the share of the forecast's
 * members meeting the event (the `?prob=` machinery), except the gust chance (see its
 * `method`).
 */
export interface PassChances {
  /** The window's length, 24. */
  readonly windowHours: number;
  readonly from: string;
  readonly to: string;
  /** Snowfall total over the window of 1 in (25.4 mm) or more: `prob=snowfall:ge:<1 in>:24h`. */
  readonly pSnowGe1in: PassChance;
  /** Snowfall total over the window of 6 in (152.4 mm) or more. */
  readonly pSnowGe6in: PassChance;
  /**
   * Some hour of the window in which the member is at or below freezing (`threshold`: 0 C, 32
   * F) with precipitation of at least `precipitation_threshold` (0.254 mm, 0.01 in) in the
   * member's value ending at that hour: a wet ...
   */
  readonly pWetBelowFreezing: PassChance;
  /** A gust over 40 mph (17.9 m/s; threshold fixed, does not change with units) in the window. */
  readonly pGustGt40mph: PassChance;
}

/** The `PassChance` shape. */
export interface PassChance {
  /** 0-1 (0.001); null when it cannot be answered (`null_reason`). */
  readonly probability: number | null;
  /** The event's threshold, in the response's units. */
  readonly threshold: number;
  /**
   * For `p_wet_below_freezing`, the precipitation that makes an hour wet, in the response's
   * units.
   */
  readonly precipitationThreshold?: number;
  /** The members that voted (0 for `hourly_gust_distribution`). */
  readonly members: number;
  readonly method: Open<'members' | 'hourly_gust_distribution'>;
  readonly nullReason?: Open<'window_not_covered' | 'too_few_members' | 'variable_unavailable'>;
}

/** The `PassSnowWindow` shape. */
export interface PassSnowWindow {
  /** When the first snowing hour begins (its `valid_time` minus 1 h). */
  readonly start: string;
  /** When the last snowing hour ends (its `valid_time`). */
  readonly end: string;
  /**
   * The sum of the hourly snowfall means over the spell (mm, in), as `snow_outlook` sums its
   * windows.
   */
  readonly total: number;
  /**
   * The p10 of the members' own totals over the spell (`?totals=` machinery); omitted without
   * enough members.
   */
  readonly p10?: number;
  /** The p90 of the members' own totals over the spell. */
  readonly p90?: number;
  /**
   * The share of members whose own total over the spell is 1 in (25.4 mm) or more; threshold
   * fixed, does not change with units.
   */
  readonly pGe1in?: number;
}

/** The `PassHour` shape. */
export interface PassHour {
  /** The hour's `valid_time`; amounts are over the hour ending then. */
  readonly time: string;
  /** `ensemble.temperature.mean`. */
  readonly temperature: number;
  /** `ensemble.precipitation.mean` (mm, in). */
  readonly precipitation: number;
  /** `ensemble.precipitation.probability`, 0-1. */
  readonly precipitationProbability?: number;
  /** The hour's served `precipitation_type.type`; omitted on a dry hour. */
  readonly precipitationType?: Open<'rain' | 'snow' | 'rain_snow_mix' | 'freezing_rain'>;
  /** `ensemble.snowfall.mean` (mm, in); 0 without snow. */
  readonly snowfall: number;
  /** `ensemble.snow_level.mean` (m, ft); omitted where not served. */
  readonly snowLevel?: number;
  /**
   * (JSON `snow_level_above_pass`) `snow_level` minus the pass's elevation (m, ft): above 0 the snow level is above the pass
   * (rain at the pass when wet), below 0 it is under it.
   */
  readonly snowLevelMargin?: number;
  /**
   * The hour is at or below freezing (temperature mean at or below 0 C, 32 F) and wet:
   * precipitation of at least 0.254 mm (0.01 in) in this hour or one of the two before it.
   */
  readonly freezingOnWetRoad: boolean;
  /** `ensemble.wind_speed.mean`. */
  readonly windSpeed: number;
  /** `ensemble.wind_gust.mean`; omitted where not served. */
  readonly windGust?: number;
  /** `wind_gust` is over 40 mph (17.9 m/s); threshold fixed, does not change with units. */
  readonly gustOver40mph: boolean;
  /**
   * Gusts of 25 mph (11.2 m/s) or more at or below freezing with loose snow to move: snow
   * falling this hour, 1 in (25.4 mm) or more fallen in the 24 served hours before it, or snow
   * on the ground at the pass ...
   */
  readonly blowingSnow: boolean;
}

/**
 * The quietest and the busiest stretch of weather at the pass in the next `horizon_hours`, by
 * one fixed rule on the hours above: an hour has weather when it is snowing (`snowfall` at
 * least 0.04 in, 1 mm), `freezing_on_wet_road`, or `gust_over_40mph`.
 */
export interface PassTravelWindows {
  /** The horizon's length in hours, 24. */
  readonly horizonHours: number;
  /** Null when every hour has weather. */
  readonly leastWeather: PassTravelWindow | null;
  /** Null when no hour has weather. */
  readonly mostWeather: PassTravelWindow | null;
}

/** The `PassTravelWindow` shape. */
export interface PassTravelWindow {
  /** When the run's first hour begins. */
  readonly start: string;
  /** When its last hour ends. */
  readonly end: string;
  /** The sum of the hourly snowfall means over the run (mm, in). */
  readonly snowfall: number;
  readonly freezingOnWetRoadHours: number;
  /** The highest hourly gust mean in the run; omitted where no gust is served. */
  readonly maxWindGust?: number;
}

/**
 * The DOT's own status for the road over the pass -- chain controls and closures as the DOT
 * publishes them, its wording verbatim.
 */
export interface PassOfficialStatus {
  /** The DOT feed. */
  readonly source: Open<'caltrans' | 'wsdot' | 'cdot' | 'odot'>;
  /** Who to credit, as the client shows it. */
  readonly attribution: string;
  /** The DOT's own page for this road, to link out to. */
  readonly url: string;
  /**
   * How fresh the DOT's feed behind these segments was at Ourea's last read: the time the DOT
   * wrote the file Ourea last read (Caltrans rewrites it every minute; Ourea reads it every 5),
   * and the older of two when the ...
   */
  readonly checkedAt: string;
  /** `checked_at` is more than 30 minutes before `as_of`. */
  readonly stale: boolean;
  readonly level: PassStatusLevel;
  /**
   * The DOT's chain-control and closure points on the road over the pass, each direction, in
   * the pass's curated order.
   */
  readonly segments: readonly PassStatusSegment[];
}

/** One DOT chain-control or closure point, as the DOT publishes it. */
export interface PassStatusSegment {
  /** The DOT's own id for the point. */
  readonly id: string;
  readonly route: string;
  /** The direction the point controls, as the DOT names it. */
  readonly direction: string;
  /** The DOT's name for the point (its trailing field padding removed). */
  readonly location: string;
  /** (JSON `status`) The DOT's status code, verbatim. */
  readonly state: string;
  readonly level: PassStatusLevel;
  /** (JSON `status_text`) The DOT's own description of the status, verbatim. */
  readonly text: string;
  /** When the DOT set this status. */
  readonly updatedAt: string;
  readonly lat: number;
  readonly lon: number;
  /**
   * The DOT's own report of the road surface there, verbatim, where it gives one beside the
   * restriction (WSDOT, ODOT).
   */
  readonly roadCondition?: string;
  /** The DOT's own report of the weather there, verbatim (WSDOT, ODOT). */
  readonly weatherCondition?: string;
}

/** One state DOT road-weather station's newest reading, in the response's units. */
export interface PassRoadSensor {
  /** The station's id in its network. */
  readonly stationId: string;
  /** The station's registry name, else its id. */
  readonly name: string;
  /** The feed: `rwis` (Caltrans CWWP2 RWIS) or `wsdot`. */
  readonly source: Open<'rwis' | 'wsdot'>;
  /** Who measured it, as the client credits it. */
  readonly attribution: string;
  /** Straight-line distance from the pass, km. */
  readonly distanceKm: number;
  /** The station's registry elevation in the response's length units (m, ft). */
  readonly elevation?: number;
  /** The station's registry elevation in metres. */
  readonly elevationM?: number;
  readonly observedAt: string;
  /** `observed_at` is more than 60 minutes before `as_of`. */
  readonly stale: boolean;
  /**
   * The pavement state the sensor reports (NTCIP 1204 essSurfaceStatus as `/current` sensors
   * serve it: dry, trace_moisture, wet, chemically_wet, ice_warning, ice_watch, snow_warning,
   * snow_watch, absorption, dew, frost, ...
   */
  readonly pavementCondition?: string;
  /** Pavement surface temperature: °C, °F (imperial) or K (kelvin). */
  readonly pavementTemp?: number;
  /** As `pavement_temp`. */
  readonly subsurfaceTemp?: number;
  /** Air temperature, as `pavement_temp`. */
  readonly temperature?: number;
  /** m/s or mph (imperial). */
  readonly windSpeed?: number;
  /** As `wind_speed`. */
  readonly windGust?: number;
  /** Degrees clockwise from north. */
  readonly windDirection?: number;
  /** m, or statute miles (imperial). */
  readonly visibility?: number;
}

/** One DOT camera, a still image the DOT refreshes about once a minute. */
export interface PassCamera {
  readonly id: string;
  /** The DOT's name for the camera. */
  readonly title: string;
  /** The DOT's current still image. */
  readonly imageUrl: string;
  /** The DOT's own page for the camera, to link out to. */
  readonly url: string;
  /**
   * The image's time (its Last-Modified) when Ourea last checked it, every 15 minutes; the
   * image at `image_url` may be newer.
   */
  readonly capturedAt?: string;
  /** `captured_at` is unknown or more than 60 minutes before `as_of`: the camera may be frozen. */
  readonly stale: boolean;
  readonly source: Open<'caltrans' | 'wsdot' | 'cdot' | 'odot'>;
  readonly attribution: string;
}
