// SPDX-License-Identifier: BSD-2-Clause
/**
 * Named views of a {@link Quantiles} distribution. These only pick the
 * percentiles the server sent: there is no interpolation, ever.
 *
 * @module
 */

import { UsageError } from './errors.js';
import type { Quantiles } from './models/common.js';

/** A range between two served percentiles. */
export interface QuantileRange {
  readonly low: number;
  readonly high: number;
}

/**
 * The p10..p90 (80 %) or p25..p75 (50 %) range of a distribution, or
 * `undefined` when the server did not send both ends. Any other pair is a
 * {@link UsageError}: the SDK never interpolates percentiles.
 *
 * @example
 * ```ts
 * const r = range(hour.ensemble.temperature, 'p10', 'p90');
 * if (r) console.log(`${r.low}..${r.high}`);
 * ```
 */
export function range(q: Quantiles, low: 'p10', high: 'p90'): QuantileRange | undefined;
export function range(q: Quantiles, low: 'p25', high: 'p75'): QuantileRange | undefined;
export function range(q: Quantiles, low: string, high: string): QuantileRange | undefined {
  if (!((low === 'p10' && high === 'p90') || (low === 'p25' && high === 'p75'))) {
    throw new UsageError(
      `range(${low}, ${high}): only p10..p90 and p25..p75 are served; the SDK never interpolates.`,
    );
  }
  const lo = low === 'p10' ? q.p10 : q.p25;
  const hi = high === 'p90' ? q.p90 : q.p75;
  return lo === undefined || hi === undefined ? undefined : { low: lo, high: hi };
}

/** The ensemble median (p50), or `undefined` when not sent. It is the median, not "the forecast". */
export function median(q: Quantiles): number | undefined {
  return q.p50;
}
