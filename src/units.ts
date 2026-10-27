// SPDX-License-Identifier: BSD-2-Clause
/**
 * Unit systems and thresholds with an explicit unit.
 *
 * Response values are always in the request's unit system; the SDK never
 * converts them. The only conversion here is of a threshold YOU give, so that
 * "6 inches" can be asked on a metric request.
 *
 * @module
 */

import { UsageError } from './errors.js';

/** The unit system of a request and its response. */
export type UnitSystem = 'metric' | 'imperial' | 'kelvin';

/** The unit systems the API serves. */
export const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'imperial', 'kelvin'];

/** A unit a threshold may be given in. */
export type ThresholdUnit = 'mm' | 'in' | 'degC' | 'degF' | 'K' | 'm' | 'ft' | 'm/s' | 'mph';

/** A number with its unit, for example `{ value: 6, unit: 'in' }`. */
export interface Threshold {
  readonly value: number;
  readonly unit: ThresholdUnit;
}

/** A threshold in millimetres. */
export const millimeters = (value: number): Threshold => ({ value, unit: 'mm' });
/** A threshold in inches. */
export const inches = (value: number): Threshold => ({ value, unit: 'in' });
/** A threshold in centimetres (stored as millimetres, exactly). */
export const centimeters = (value: number): Threshold => ({ value: value * 10, unit: 'mm' });
/** A temperature threshold in degrees Celsius. */
export const celsius = (value: number): Threshold => ({ value, unit: 'degC' });
/** A temperature threshold in degrees Fahrenheit. */
export const fahrenheit = (value: number): Threshold => ({ value, unit: 'degF' });
/** A temperature threshold in kelvin. */
export const kelvin = (value: number): Threshold => ({ value, unit: 'K' });
/** A height threshold in metres. */
export const meters = (value: number): Threshold => ({ value, unit: 'm' });
/** A height threshold in feet. */
export const feet = (value: number): Threshold => ({ value, unit: 'ft' });
/** A speed threshold in metres per second. */
export const metersPerSecond = (value: number): Threshold => ({ value, unit: 'm/s' });
/** A speed threshold in miles per hour. */
export const mph = (value: number): Threshold => ({ value, unit: 'mph' });

/** @internal The physical dimension of a variable or unit. */
export type Dimension = 'depth' | 'temperature' | 'speed' | 'height';

const UNIT_DIMENSION: ReadonlyMap<string, Dimension> = new Map<ThresholdUnit, Dimension>([
  ['mm', 'depth'],
  ['in', 'depth'],
  ['degC', 'temperature'],
  ['degF', 'temperature'],
  ['K', 'temperature'],
  ['m/s', 'speed'],
  ['mph', 'speed'],
  ['m', 'height'],
  ['ft', 'height'],
]);

/** @internal The unit a dimension is served in, per unit system (BEHAVIOR.md section 7). */
export function servedUnit(dimension: Dimension, units: UnitSystem): ThresholdUnit {
  const imperial = units === 'imperial';
  switch (dimension) {
    case 'depth':
      return imperial ? 'in' : 'mm';
    case 'temperature':
      return imperial ? 'degF' : units === 'kelvin' ? 'K' : 'degC';
    case 'speed':
      return imperial ? 'mph' : 'm/s';
    case 'height':
      return imperial ? 'ft' : 'm';
  }
}

// Each unit's value expressed in its dimension's metric base unit
// (mm, degC, m/s, m), with the exact factors of BEHAVIOR.md section 7.
function toBase(value: number, unit: ThresholdUnit): number {
  switch (unit) {
    case 'in':
      return value * 25.4;
    case 'ft':
      return value * 0.3048;
    case 'mph':
      return value * 0.44704;
    case 'degF':
      return ((value - 32) * 5) / 9;
    case 'K':
      return value - 273.15;
    case 'mm':
    case 'degC':
    case 'm/s':
    case 'm':
      return value;
  }
}

function fromBase(value: number, unit: ThresholdUnit): number {
  switch (unit) {
    case 'in':
      return value / 25.4;
    case 'ft':
      return value / 0.3048;
    case 'mph':
      return value / 0.44704;
    case 'degF':
      return (value * 9) / 5 + 32;
    case 'K':
      return value + 273.15;
    case 'mm':
    case 'degC':
    case 'm/s':
    case 'm':
      return value;
  }
}

/**
 * @internal Converts a caller's threshold into the request's unit system.
 * A number without a unit is taken to be in the request's units already.
 */
export function convertThreshold(
  threshold: number | Threshold,
  dimension: Dimension,
  units: UnitSystem,
  what: string,
): number {
  if (typeof threshold === 'number') return threshold;
  const { value, unit } = threshold;
  const unitDimension = UNIT_DIMENSION.get(unit);
  if (unitDimension === undefined) {
    throw new UsageError(`${what}: unknown threshold unit '${unit}'.`);
  }
  if (unitDimension !== dimension) {
    throw new UsageError(`${what}: a ${dimension} threshold cannot be given in '${unit}'.`);
  }
  const target = servedUnit(dimension, units);
  return unit === target ? value : fromBase(toBase(value, unit), target);
}
