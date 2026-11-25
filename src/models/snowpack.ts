// SPDX-License-Identifier: BSD-2-Clause
// The snowpack forecast and its snow-depth plume (beta).

import type { UnitSystem } from '../units.js';
import type { LocationRef } from './common.js';

/** The snowpack forecast of a location's spots. */
export interface SnowpackResponse {
  /** Always `true` while the product is a beta; fields may be added. */
  readonly beta: boolean;
  readonly location: LocationRef;
  readonly units: UnitSystem;
  readonly modelRun?: SnowpackRun;
  /** The newest run's blend cycle is more than 24 h old. */
  readonly stale: boolean;
  /** The location's own point first, then its named elevations in their display order. */
  readonly spots: readonly SnowpackSpot[];
  readonly definitions: SnowpackResponseDefinitions;
}

/** The `SnowpackResponseDefinitions` shape. */
export interface SnowpackResponseDefinitions {
  /** Each surface class and what it means. */
  readonly surface: Readonly<Record<string, string>>;
  /** Each layer form and what it is. */
  readonly layerForm: Readonly<Record<string, string>>;
}

/** The newest snowpack run among the spots served. */
export interface SnowpackRun {
  /** The blend cycle the snowpack model was driven with. */
  readonly initializedAt: string;
  readonly generatedAt: string;
  readonly model: SnowpackModel;
}

/** The `SnowpackModel` shape. */
export interface SnowpackModel {
  readonly name: string;
  readonly by: string;
  readonly license: string;
  /**
   * The build that ran: the commits of Ourea's SNOWPACK and MeteoIO source it was built from,
   * as `snowpack <commit> meteoio <commit>`.
   */
  readonly version?: string;
}

/** The `SnowpackSpot` shape. */
export interface SnowpackSpot {
  /** The named elevation (`location.elevations[].name`); `null` is the location's own point. */
  readonly name: string | null;
  /**
   * What the named elevation is called, as `ElevationSummary.display_name`; absent for the
   * location's own point and where the catalog has no name for the elevation.
   */
  readonly displayName?: string;
  /** In the response's units (m or ft). */
  readonly elevation: number;
  readonly elevationM: number;
  /**
   * The blend cycle this spot's forecast was driven with; older than `model_run.initialized_at`
   * when the newest run did not reach the spot.
   */
  readonly initializedAt: string;
  /** The snow-depth sensor at the spot. */
  readonly anchor?: SnowpackSpotAnchor;
  readonly depth: SnowpackDepth;
  /**
   * The depth at `depth.start_time` less this spot's modelled depth 24 h before, in the depth's
   * units and rounding (cm or in; a loss is negative): the model's own change, snowfall,
   * settlement and melt together.
   */
  readonly depthChange24h?: number;
  /** Hourly snow water equivalent (mm or in), parallel to `depth.p50`. */
  readonly swe: readonly number[];
  /** One entry every six hours. */
  readonly steps: readonly SnowpackStep[];
  /** Buried layers at `depth.start_time`, at most three. */
  readonly layers: readonly SnowpackLayer[];
  /** The snow on a 38° slope at the spot facing each way, in the order north, east, south, west. */
  readonly aspects?: readonly SnowpackAspect[];
}

/** The snow-depth sensor at the spot. */
export interface SnowpackSpotAnchor {
  /** The station's catalog slug. */
  readonly station: string;
  readonly name: string;
  readonly network: string;
}

/** The `SnowpackStep` shape. */
export interface SnowpackStep {
  readonly validTime: string;
  /**
   * A key of `definitions.surface`: today `none`, `powder`, `wind_affected`, `settled`, `wet`,
   * `crust` or `ice_crust`.
   */
  readonly surface: string;
  /** New snow of the 24 h to `valid_time`, as it lies (cm or in). */
  readonly newSnow24h: number;
  /** Its density. */
  readonly newSnowDensityKgM3?: number;
  /** How far the snow on the ground 24 h earlier settled (cm or in). */
  readonly settlement24h?: number;
}

/** The `SnowpackLayer` shape. */
export interface SnowpackLayer {
  /**
   * A key of `definitions.layer_form`: today `faceted_grains`, `depth_hoar`,
   * `buried_surface_hoar`, `melt_freeze_crust`, `ice_layer` or `rounding_facets`.
   */
  readonly form: string;
  /** cm or in. */
  readonly thickness: number;
  /** From the surface down to the layer's top (cm or in). */
  readonly depth: number;
  readonly formed: string;
}

/**
 * The snow on one slope at a spot, described as the spot's flat ground is: the model run on a
 * slope of `slope_angle_deg` facing `aspect`, with the flat ground's snowfall and the slope's
 * own sun.
 */
export interface SnowpackAspect {
  /** (JSON `aspect`) The way the slope faces: today `north`, `east`, `south` or `west`. */
  readonly facing: string;
  /** How steep the slope is, degrees from horizontal. */
  readonly slopeAngleDeg: number;
  /** Hourly snow depth on the slope, measured vertically as the flat depth is. */
  readonly depth: SnowpackDepth;
  /**
   * As the spot's `depth_change_24h`, this slope's own (open loop on both sides), read from the
   * same earlier run as the spot's and from no other.
   */
  readonly depthChange24h?: number;
  /** One entry every six hours, at the spot's own `steps[].valid_time`. */
  readonly steps: readonly SnowpackStep[];
  /** Buried layers on the slope at `depth.start_time`, at most three. */
  readonly layers: readonly SnowpackLayer[];
}

/** Hourly snow depth from `start_time` (cm or in). */
export interface SnowpackDepth {
  readonly startTime: string;
  readonly intervalHours: number;
  /** `measured`: started from a sensor reading at the spot. */
  readonly basis: string;
  readonly p10?: readonly number[];
  readonly p50: readonly number[];
  readonly p90?: readonly number[];
}

/** A location's snow-depth plume. */
export interface SnowpackPlumeResponse {
  /** Always `true` while the product is a beta; fields may be added. */
  readonly beta: boolean;
  readonly location: LocationRef;
  readonly units: UnitSystem;
  /** The run the plume is from: the 12Z blend cycle the members were read from. */
  readonly modelRun?: SnowpackRun;
  /** The plume's blend cycle is more than 24 h old. */
  readonly stale: boolean;
  /** The members' depth at each step. */
  readonly depth?: SnowpackPlumeDepth;
  /** Every member's own series, by model, each model to its own horizon. */
  readonly models?: readonly SnowpackPlumeModel[];
  /**
   * Every member's depth as ONE unlabelled pool, for Free and anonymous callers (absent for
   * Plus and Pro, who are served `models`).
   */
  readonly memberDepths?: readonly (readonly number[])[];
  /** What the bands are, in a sentence a client may show beside them. */
  readonly spread: string;
}

/** The members' depth at each step. */
export interface SnowpackPlumeDepth {
  /** The time of the first value of every series in the body. */
  readonly startTime: string;
  /** Hours between values (3). */
  readonly intervalHours: number;
  /** Members that reach each step; it falls where a model's horizon ends. */
  readonly members: readonly number[];
  /** The members' median depth, in the response's units. */
  readonly p50?: readonly number[];
  /** Served to every caller, as the bands are. */
  readonly mean: readonly number[];
  /** Every caller (Plus and Pro only before). */
  readonly p10: readonly number[];
  /** Every caller (Plus and Pro only before). */
  readonly p25: readonly number[];
  /** Every caller (Plus and Pro only before). */
  readonly p75: readonly number[];
  /** Every caller (Plus and Pro only before). */
  readonly p90: readonly number[];
}

/** The `SnowpackPlumeModel` shape. */
export interface SnowpackPlumeModel {
  /** `aifs`, `aigefs`, `gefs` or `ifs_ens`; a client must tolerate one it does not know. */
  readonly id: string;
  /** The model's own member numbers, in the order of `depth`. */
  readonly memberIds: readonly number[];
  /** One series per member, from `depth.start_time` every `depth.interval_hours`. */
  readonly depth: readonly (readonly number[])[];
  /**
   * The equal-weight mean of this model's members' `depth` at each of the model's own steps
   * (from `depth.start_time` every `depth.interval_hours`, to the model's horizon: the length
   * of its members' series), in the ...
   */
  readonly depthMean: readonly number[];
  /**
   * Members not run because the ground starts bare and they bring no snow; their series is 0
   * throughout.
   */
  readonly membersSkipped: number;
}
