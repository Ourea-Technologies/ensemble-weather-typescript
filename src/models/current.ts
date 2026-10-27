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
import type { TimeSeriesPoint } from './forecast.js';

/** The conditions now, from the nowcast or the model. */
export interface CurrentConditions {
  readonly time: string;
  readonly temperature: number;
  readonly feelsLike?: number;
  readonly condition: string;
  readonly conditionText: string;
  readonly conditionIcon: string;
  readonly windSpeed: number;
  readonly windGust?: number;
  readonly windDirection: number;
  readonly relativeHumidity?: number;
  readonly dewpoint?: number;
  readonly precipProbability?: number;
  /** Where these values came from. */
  readonly source: Open<'nowcast' | 'model'>;
  readonly station?: CurrentStation;
}

/** The station a nowcast reading came from. */
export interface CurrentStation {
  readonly name: string;
  readonly observationTime: string;
}

/** One sensor's latest observation. Every reading is optional. */
export interface SensorObservation {
  readonly stationId: string;
  readonly name: string;
  readonly source: string;
  readonly observationTime: string;
  readonly temperature?: number;
  readonly dewpoint?: number;
  readonly relativeHumidity?: number;
  readonly windSpeed?: number;
  readonly windGust?: number;
  readonly windDirection?: number;
  readonly pressure?: number;
  readonly precipitation?: number;
  readonly precipRate?: number;
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
}

/** Current conditions, sensors and alerts for a location or point. */
export interface CurrentResponse {
  readonly location: LocationRef;
  readonly alerts: readonly ActiveAlert[];
  readonly alertsAsOf: string;
  readonly sensorCount: number;
  readonly sensors: readonly SensorObservation[];
  /** `null` when nothing current is available: never a substituted default. */
  readonly current: CurrentConditions | null;
  readonly asOf: string;
  readonly modelRunInitializedAt: string | null;
  /** The obs-blended band, with `include: ['nowcast_hours']`. */
  readonly nowcastHours: readonly TimeSeriesPoint[] | null;
  readonly units: UnitSystem;
  readonly attribution: ResponseAttribution;
  readonly nowcastUnavailable?: readonly Open<
    'observation' | 'radar' | 'cloud' | 'nearest_sensors'
  >[];
}

/** Active alerts for a location or point. */
export interface AlertsResponse {
  readonly location: LocationRef;
  readonly alertCount: number;
  readonly asOf: string;
  readonly alerts: readonly ActiveAlert[];
  readonly attribution: ResponseAttribution;
}

/** A location near another, with its distance. */
export interface NearbyLocation extends LocationSummary {
  readonly distanceKm: number;
}

/** Locations near a named location. */
export interface NearbyLocationsResponse {
  readonly location: LocationSummary;
  readonly radiusKm: number;
  readonly count: number;
  readonly locations: readonly NearbyLocation[];
}

/** Locations near a point. */
export interface NearbyPointResponse {
  readonly lat: number;
  readonly lon: number;
  readonly radiusKm: number;
  readonly count: number;
  readonly locations: readonly NearbyLocation[];
}
