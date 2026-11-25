// SPDX-License-Identifier: BSD-2-Clause
// Current conditions, alerts and nearby locations.

import type { UnitSystem } from '../units.js';
import type {
  ActiveAlert,
  LocationRef,
  LocationSummary,
  Open,
  ResponseAttribution,
} from './common.js';
import type { ConditionIcon, TimeSeriesPoint } from './forecast.js';
import type { PassForecast, PlaceSummary } from './places.js';

/** The conditions now, from the nowcast or the model. */
export interface CurrentConditions {
  readonly time: string;
  readonly temperature: number;
  readonly feelsLike?: number;
  /** (JSON `condition`) */
  readonly code: string;
  /** (JSON `condition_text`) */
  readonly text: string;
  /** (JSON `condition_icon`) */
  readonly icon: ConditionIcon;
  readonly windSpeed: number;
  readonly windGust?: number;
  readonly windDirection: number;
  readonly relativeHumidity?: number;
  readonly dewpoint?: number;
  readonly precipitationProbability?: number;
  /** Where these values came from. */
  readonly source: Open<'nowcast' | 'model'>;
  readonly station?: CurrentStation;
  /**
   * The hour in progress's `measured`, the hour `condition` and `precipitation_probability` are
   * read from: the radar's published accumulation for that clock hour so far is served above 0
   * (above 0.00 mm and 0.000 in), so ...
   */
  readonly measured: boolean;
  /**
   * Cloud cover, percent (0-100), the mean of the hour in progress's `ensemble.cloud_cover`:
   * the hour `condition` is read from, so the number and the label describe one hour.
   */
  readonly cloudCover?: number;
}

/** The station a nowcast reading came from. */
export interface CurrentStation {
  /** (JSON `station_id`) The station's id in its network. */
  readonly id: string;
  readonly name: string;
  readonly observationTime: string;
  /** `True` when the station's reading was calm (0 wind speed; a METAR's `00000KT`). */
  readonly calm: boolean;
}

/** One sensor's latest observation. Every reading is optional. */
export interface SensorObservation {
  readonly stationId: string;
  readonly name: string;
  readonly source: string;
  /** (JSON `observation_time`) */
  readonly observedAt: string;
  readonly temperature?: number;
  readonly dewpoint?: number;
  readonly relativeHumidity?: number;
  readonly windSpeed?: number;
  readonly windGust?: number;
  readonly windDirection?: number;
  readonly pressure?: number;
  readonly precipitation?: number;
  readonly precipitationRate?: number;
  readonly reflectivity?: number;
  readonly pavementTemp?: number;
  readonly subsurfaceTemp?: number;
  readonly visibility?: number;
  readonly cloudCover?: number;
  readonly ceilingHeight?: number;
  readonly snowDepth?: number;
  readonly swe?: number;
  readonly swePercentOfMedian?: number;
  readonly snowfall?: number;
  readonly solarRadiation?: number;
  readonly pavementCondition?: string;
  /**
   * Straight-line surface distance from the location to the sensor, in km (at most 25), as
   * `nearest_sensors[].distance_km`.
   */
  readonly distanceKm: number;
  /**
   * The sensor's registry elevation minus the location's, in the caller's length units (m
   * metric, ft imperial), as `nearest_sensors[].elevation_diff`.
   */
  readonly elevationDiff?: number;
}

/** Current conditions, sensors and alerts for a location or point. */
export interface CurrentResponse {
  readonly location: LocationRef;
  readonly alerts: readonly ActiveAlert[];
  readonly alertsAsOf: string;
  readonly sensorCount: number;
  readonly sensors: readonly SensorObservation[];
  /** (JSON `current`) `null` when nothing current is available: never a substituted default. */
  readonly now: CurrentConditions | null;
  readonly asOf: string;
  readonly modelRunInitializedAt: string | null;
  /**
   * The obs-blended band: present only with `include: ['nowcast_hours']`, and
   * then `null` when no cycle is servable.
   */
  readonly nowcastHours?: readonly TimeSeriesPoint[] | null;
  readonly units: UnitSystem;
  readonly attribution: ResponseAttribution;
  readonly nowcastUnavailable?: readonly Open<
    'observation' | 'radar' | 'cloud' | 'nearest_sensors'
  >[];
  /**
   * The place summary, written by the server from served values only, so every client shows the
   * same words.
   */
  readonly summary?: PlaceSummary;
  /** The mountain pass forecast at the pass's own point and elevation. */
  readonly pass?: PassForecast;
}

/** Active alerts for a location or point. */
export interface AlertsResponse {
  readonly location: LocationRef;
  /** (JSON `alert_count`) */
  readonly count: number;
  readonly asOf: string;
  /** (JSON `alerts`) */
  readonly items: readonly ActiveAlert[];
  readonly attribution: ResponseAttribution;
}

/** A location near another, with its distance. */
export interface NearbyLocation extends LocationSummary {
  readonly distanceKm: number;
}

/** Locations near a named location. */
export interface NearbyLocationsResponse {
  /** (JSON `location`) */
  readonly origin: LocationSummary;
  readonly radiusKm: number;
  readonly count: number;
  /** (JSON `locations`) */
  readonly items: readonly NearbyLocation[];
}

/** Locations near a point. */
export interface NearbyPointResponse {
  readonly lat: number;
  readonly lon: number;
  readonly radiusKm: number;
  readonly count: number;
  /** (JSON `locations`) */
  readonly items: readonly NearbyLocation[];
}
