// SPDX-License-Identifier: BSD-2-Clause
// Location lists, search, the public catalog, runs, storm reports and attribution.

import type { LocationSummary, LocationType, ModelEntry, Open } from './common.js';

/** One page of a state's (or every state's) locations. */
export interface LocationsResponse {
  readonly state: string;
  readonly count: number;
  readonly locations: readonly LocationSummary[];
  /** Pass back as `cursor` for the next page; absent on the last page. */
  readonly nextCursor?: string;
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
  readonly county?: string | null;
  readonly country?: string;
  readonly aliases?: readonly string[] | null;
  readonly descriptionShort?: string | null;
  readonly descriptionLong?: string | null;
  readonly microclimateNotes?: string | null;
  readonly metaTitle?: string | null;
  readonly metaDescription?: string | null;
  readonly bestSeasons?: readonly string[] | null;
  readonly keyFactors?: readonly string[] | null;
  readonly tags?: readonly string[] | null;
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
  readonly ads?: readonly CatalogResolvedAdSlot[];
}

/** A named elevation of a catalog location. */
export interface CatalogElevation {
  readonly label: string;
  readonly elevationM: number;
  readonly latOverride?: number | null;
  readonly lonOverride?: number | null;
  readonly isDefault: boolean;
}

/** A photo with its credit and licence. */
export interface CatalogPhoto {
  readonly url: string;
  readonly caption?: string | null;
  readonly credit?: string | null;
  readonly altText?: string | null;
  readonly license?: string | null;
  readonly licenseUrl?: string | null;
}

/** A webcam. */
export interface CatalogWebcam {
  readonly name: string;
  readonly url: string;
  readonly embedType?: string | null;
  readonly provider?: string | null;
  readonly refreshIntervalSeconds?: number | null;
}

/** A station near a catalog location. */
export interface CatalogNearbyStation {
  readonly slug: string;
  readonly name: string;
  readonly network: string;
  readonly stationStatus: string;
  readonly distanceKm?: number | null;
  readonly elevationDiffM?: number | null;
  readonly isPrimary: boolean;
}

/** The page template a catalog location renders with. */
export interface CatalogTemplateSummary {
  readonly id: string;
  readonly locationType: string | null;
  readonly templateVariant: string | null;
  readonly spec: readonly CmsTemplateSection[];
}

/** One section of a page template. */
export interface CmsTemplateSection {
  readonly kind: Open<'weather_panel' | 'content_slot' | 'ad_slot' | 'media'>;
  readonly key: string;
  /** Free-form configuration, passed through as the server sent it. */
  readonly config?: Readonly<Record<string, unknown>> | null;
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

/** A resolved ad slot. */
export interface CatalogResolvedAdSlot {
  readonly slotKey: string;
  readonly kind: Open<'house' | 'third_party'>;
  readonly house?: CatalogHousePlacement;
  readonly thirdParty?: CatalogThirdPartyPlacement;
  readonly sizes: readonly (readonly number[])[];
}

/** A house ad placement. */
export interface CatalogHousePlacement {
  readonly campaignId: string;
  readonly creativeId: string;
  readonly content: CmsAdCreativeContent;
}

/** A house ad's creative. */
export interface CmsAdCreativeContent {
  readonly headline?: string;
  readonly body?: string;
  readonly cta?: string;
  readonly clickUrl?: string;
  readonly photoId?: string;
}

/** A third-party ad placement. */
export interface CatalogThirdPartyPlacement {
  readonly unitId: string;
  readonly provider: Open<'adsense' | 'gam' | 'custom'>;
  /** Free-form configuration, passed through as the server sent it. */
  readonly config: Readonly<Record<string, unknown>>;
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
  readonly county?: string | null;
  readonly country?: string;
  readonly aliases?: readonly string[] | null;
  readonly network?: string;
  readonly sourceStationId?: string;
  readonly elevationMslM?: number | null;
  readonly sensorHeightAglM?: number | null;
  readonly sensorCapabilities?: readonly string[] | null;
  readonly stationStatus?: string;
  readonly lastReportAt?: string | null;
  /** Free-form, passed through as the server sent it. */
  readonly lastReportSummary?: unknown;
  readonly installDate?: string | null;
  readonly decommissionDate?: string | null;
  readonly updateFrequencyMinutes?: number | null;
  readonly stationUrl?: string | null;
  readonly dataUrl?: string | null;
  readonly descriptionShort?: string | null;
  readonly descriptionLong?: string | null;
  readonly metaTitle?: string | null;
  readonly metaDescription?: string | null;
  readonly tags?: readonly string[] | null;
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
  readonly primaryLocation?: CatalogPrimaryLocation | null;
  readonly template?: CatalogTemplateSummary;
  readonly content?: readonly CatalogResolvedEntry[];
  readonly ads?: readonly CatalogResolvedAdSlot[];
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

/** Recent storm verification reports. */
export interface StormReportsResponse {
  readonly reports: readonly StormReportCard[];
  readonly count: number;
}

/** How a past storm's forecast compared with what fell. */
export interface StormReportCard {
  readonly id: number;
  readonly locationName: string;
  readonly eventType: string;
  readonly onsetTime: string;
  readonly endTime: string;
  readonly forecastTotalMm: number;
  readonly observedTotalMm: number;
  readonly forecastSnowfallMm?: number | null;
  readonly observedSnowfallMm?: number | null;
  readonly bestModel?: string | null;
  readonly bestLeadTimeHours?: number | null;
  readonly compositeScore?: number | null;
  readonly headline?: string | null;
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
