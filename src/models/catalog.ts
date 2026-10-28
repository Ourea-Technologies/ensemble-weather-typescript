// SPDX-License-Identifier: BSD-2-Clause
// Location lists, search, the public catalog, runs and attribution.

import type { LocationSummary, LocationType, ModelEntry, Open } from './common.js';

/** Observation networks the API knows today (snake_case). */
export const STATION_NETWORKS = [
  'snotel',
  'snolite',
  'raws',
  'asos',
  'awos',
  'metar',
  'rwis_wsdot',
  'rwis_odot',
  'rwis_caltrans',
  'rwis_idot',
  'rwis_ndot',
  'rwis_udot',
  'rwis_cdot',
  'rwis_mdt',
  'rwis_wydot',
  'rwis_other',
  'agrimet',
  'agweathernet',
  'cocorahs',
  'coop',
  'usgs',
  'tempest',
  'davis',
  'wxflow',
  'cdec',
  'cimis',
  'mesonet_oregon',
  'mesonet_synoptic',
  'mesonet_other',
  'ndbc_buoy',
  'other',
  'hads',
  'madis',
  'nwac',
  'mt_mesonet',
] as const;

/** A station's observation network (`snotel`, `raws`, ...). Open: see {@link Open}. */
export type StationNetwork = Open<(typeof STATION_NETWORKS)[number]>;

/** A station's live-feed status. */
export type StationStatus = Open<
  'active' | 'intermittent' | 'inactive' | 'decommissioned' | 'unknown'
>;

/** A catalog page template's variant. */
export type TemplateVariant = Open<
  'mountain' | 'coastal' | 'trail' | 'pass' | 'generic' | 'station'
>;

/** One page of a state's (or every state's) locations. */
export interface LocationsResponse {
  readonly state: string;
  readonly count: number;
  readonly locations: readonly LocationSummary[];
  /** Pass back as `cursor` for the next page; `null` on the last page. */
  readonly nextCursor: string | null;
}

/** A search hit. `key` is the `state/slug` pair a forecast call takes. */
export interface SearchHit {
  readonly key: string;
  readonly slug: string;
  readonly state: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly elevationM: number;
  readonly type: LocationType;
  readonly timezone: string;
  readonly county: string;
}

/** Search results, best first. */
export interface SearchLocationsResponse {
  readonly items: readonly SearchHit[];
  readonly count: number;
}

/** A location in the public catalog. */
export interface CatalogLocation {
  readonly slug: string;
  readonly state: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly elevationM: number;
  readonly type: LocationType;
  readonly timezone: string;
  readonly county?: string;
  readonly country?: string;
  readonly aliases?: readonly string[];
  readonly descriptionShort?: string;
  readonly descriptionLong?: string;
  readonly microclimateNotes?: string;
  readonly metaTitle?: string;
  readonly metaDescription?: string;
  readonly bestSeasons?: readonly string[];
  readonly keyFactors?: readonly string[];
  readonly tags?: readonly string[];
  /** Free-form links, passed through as the server sent them. */
  readonly externalLinks?: unknown;
  readonly isFeatured?: boolean;
}

/** One page of the location catalog. */
export interface CatalogLocationPage {
  readonly items: readonly CatalogLocation[];
  /** Pass back as `cursor` for the next page; `null` on the last page. */
  readonly nextCursor: string | null;
}

/** A catalog location with its elevations, media and nearby stations. */
export interface CatalogLocationDetail extends CatalogLocation {
  readonly elevations: readonly CatalogElevation[];
  readonly photos: readonly CatalogPhoto[];
  readonly webcams: readonly CatalogWebcam[];
  readonly nearbyStations: readonly CatalogNearbyStation[];
  readonly template?: CatalogTemplateSummary;
  readonly content?: readonly CatalogResolvedEntry[];
}

/** A named elevation of a catalog location. */
export interface CatalogElevation {
  readonly label: string;
  readonly elevationM: number;
  readonly latOverride?: number;
  readonly lonOverride?: number;
  readonly isDefault: boolean;
}

/** A photo with its credit and licence. */
export interface CatalogPhoto {
  readonly url: string;
  readonly caption?: string;
  readonly credit?: string;
  readonly altText?: string;
  readonly license?: string;
  readonly licenseUrl?: string;
}

/** A webcam. */
export interface CatalogWebcam {
  readonly name: string;
  readonly url: string;
  readonly embedType?: string;
  readonly provider?: string;
  readonly refreshIntervalSeconds?: number;
}

/** A station near a catalog location. */
export interface CatalogNearbyStation {
  readonly slug: string;
  readonly name: string;
  readonly network: StationNetwork;
  readonly stationStatus: StationStatus;
  readonly distanceKm?: number;
  readonly elevationDiffM?: number;
  readonly isPrimary: boolean;
}

/** The page template a catalog location renders with. */
export interface CatalogTemplateSummary {
  readonly id: string;
  readonly locationType: LocationType | null;
  readonly templateVariant: TemplateVariant | null;
  readonly spec: readonly CmsTemplateSection[];
}

/** One section of a page template. */
export interface CmsTemplateSection {
  readonly kind: Open<'weather_panel' | 'content_slot' | 'ad_slot' | 'media'>;
  readonly key: string;
  /** Free-form configuration, passed through as the server sent it. */
  readonly config?: Readonly<Record<string, unknown>>;
}

/** A resolved content entry. */
export interface CatalogResolvedEntry {
  readonly id: string;
  readonly contentTypeKey: string;
  readonly title: string;
  /** Free-form content, passed through as the server sent it. */
  readonly body: Readonly<Record<string, unknown>>;
  readonly slot: string;
  readonly displayOrder: number;
  readonly resolvedLocale: string;
  readonly updatedAt: string;
}

/** An observation station in the public catalog. */
export interface CatalogStation {
  readonly slug: string;
  readonly state: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly elevationM: number;
  readonly type: LocationType;
  readonly timezone: string;
  readonly county?: string;
  readonly country?: string;
  readonly aliases?: readonly string[];
  readonly network?: StationNetwork;
  readonly sourceStationId?: string;
  readonly elevationMslM?: number;
  readonly sensorHeightAglM?: number;
  readonly sensorCapabilities?: readonly string[];
  readonly stationStatus?: StationStatus;
  readonly lastReportAt?: string;
  /** Free-form, passed through as the server sent it. */
  readonly lastReportSummary?: unknown;
  readonly installDate?: string;
  readonly decommissionDate?: string;
  readonly updateFrequencyMinutes?: number;
  readonly stationUrl?: string;
  readonly dataUrl?: string;
  readonly descriptionShort?: string;
  readonly descriptionLong?: string;
  readonly metaTitle?: string;
  readonly metaDescription?: string;
  readonly tags?: readonly string[];
  readonly isFeatured?: boolean;
}

/** One page of the station catalog. */
export interface CatalogStationPage {
  readonly items: readonly CatalogStation[];
  readonly nextCursor: string | null;
}

/** A catalog station with its media and primary location. */
export interface CatalogStationDetail extends CatalogStation {
  readonly photos: readonly CatalogPhoto[];
  readonly webcams: readonly CatalogWebcam[];
  readonly primaryLocation?: CatalogPrimaryLocation;
  readonly template?: CatalogTemplateSummary;
  readonly content?: readonly CatalogResolvedEntry[];
}

/** The location a station primarily serves. */
export interface CatalogPrimaryLocation {
  readonly slug: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly elevationM: number;
  readonly type: string;
}

/** Model runs: the one served and the ones available. */
export interface RunsResponse {
  readonly served: ServedRun | null;
  readonly runs: readonly RunInfo[];
  readonly count: number;
  /** Pass back as `cursor` for the next page; `null` on the last page. */
  readonly nextCursor: string | null;
}

/** The run forecasts are served from. */
export interface ServedRun {
  readonly initializedAt: string;
  readonly models: readonly ModelEntry[];
}

/** An available run. */
export interface RunInfo {
  readonly initializedAt: string;
}

/** Every data source with its provider's licence and required statements. */
export interface AttributionRegistry {
  readonly providers: readonly AttributionProvider[];
}

/** A data provider. */
export interface AttributionProvider {
  readonly id: string;
  readonly name: string;
  readonly credit: string;
  readonly licence: string;
  readonly licenceUrl: string;
  readonly termsUrl: string;
  readonly modified: boolean;
  readonly notices: readonly string[];
  readonly sources: readonly AttributionSource[];
}

/** One data source. */
export interface AttributionSource {
  readonly id: string;
  readonly name: string;
  readonly kind: Open<
    'model' | 'peer' | 'observation' | 'alerts' | 'climatology' | 'terrain' | 'places' | 'basemap'
  >;
  readonly provider: string;
}
