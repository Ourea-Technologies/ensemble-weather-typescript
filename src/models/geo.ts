// SPDX-License-Identifier: BSD-2-Clause
// GeoJSON for maps: active alert outlines and avalanche zones.

import type { Open, ResponseAttribution } from './common.js';
import type { AvalancheForecast } from './plume.js';

/** The class of an alert outline. */
export type AlertClass = Open<'wind' | 'winter'>;

/**
 * A GeoJSON `FeatureCollection` (RFC 7946) of the active winter and wind alerts' outlines, with
 * this response's `attribution` as a foreign member.
 */
export interface AlertOutlineCollection {
  readonly type: Open<'FeatureCollection'>;
  /** One Feature per alert, ordered by `properties.id`. */
  readonly features: readonly AlertOutlineFeature[];
  readonly attribution: ResponseAttribution;
}

/** One alert's outline, a GeoJSON `Feature`. */
export interface AlertOutlineFeature {
  readonly type: Open<'Feature'>;
  readonly geometry: AlertOutlineGeometry;
  readonly properties: AlertOutlineProperties;
}

/** A GeoJSON `Polygon` or `MultiPolygon`. */
export interface AlertOutlineGeometry {
  readonly type: Open<'Polygon' | 'MultiPolygon'>;
  readonly coordinates: readonly (readonly (readonly unknown[])[])[];
}

/** The alert, under the names `ActiveAlert` uses for the same fields, and its `class`. */
export interface AlertOutlineProperties {
  /** NWS alert identifier (urn:oid:…), as `ActiveAlert.id`. */
  readonly id: string;
  readonly event: string;
  readonly class: AlertClass;
  /** As `ActiveAlert.severity`. */
  readonly severity: Open<'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown'>;
  /** As `ActiveAlert.urgency`. */
  readonly urgency: Open<'immediate' | 'expected' | 'future' | 'past' | 'unknown'>;
  /** As `ActiveAlert.certainty`. */
  readonly certainty: Open<'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown'>;
  readonly headline: string;
  /** When the hazard begins. */
  readonly onset?: string;
  /** When NWS is due to re-issue this message; not the alert's end (see `ActiveAlert.expires`). */
  readonly expires: string;
  /** When the hazard ends. */
  readonly ends?: string;
  /** The NWS office. */
  readonly senderName?: string;
  /**
   * The NWS forecast page of a point inside the outline, which lists the alert and links to its
   * text: where "view on NWS" goes.
   */
  readonly sourceUrl: string;
}

/**
 * A GeoJSON `FeatureCollection` (RFC 7946) of the avalanche centers' forecast zones, each with
 * its published rating, and this response's `attribution` as a foreign member.
 */
export interface AvalancheZoneCollection {
  readonly type: Open<'FeatureCollection'>;
  /**
   * One Feature per zone, the less specific first: where zones overlap, the one drawn last is
   * the one a point there is served.
   */
  readonly features: readonly AvalancheZoneFeature[];
  readonly attribution: ResponseAttribution;
}

/** One forecast zone, a GeoJSON `Feature`. */
export interface AvalancheZoneFeature {
  readonly type: Open<'Feature'>;
  /** The zone's id, as `properties.zone_id`. */
  readonly id: number;
  readonly geometry: AvalancheZoneGeometry;
  readonly properties: AvalancheForecast;
}

/**
 * A GeoJSON `MultiPolygon`: an array of polygons, each an array of rings (the outer one first,
 * then any holes), each ring closed.
 */
export interface AvalancheZoneGeometry {
  readonly type: Open<'MultiPolygon'>;
  readonly coordinates: readonly (readonly (readonly unknown[])[])[];
}
