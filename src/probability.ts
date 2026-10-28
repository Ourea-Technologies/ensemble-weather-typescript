// SPDX-License-Identifier: BSD-2-Clause
/**
 * Probability terms (`prob=`) and window totals (`totals=`).
 *
 * The server computes every probability and every window total from the full
 * ensemble. These builders only describe the question; the SDK never sums,
 * averages or interpolates quantiles to answer one itself.
 *
 * @module
 */

import { UsageError } from './errors.js';
import { convertThreshold, type Dimension, type Threshold, type UnitSystem } from './units.js';

/** A variable a probability can be asked about. */
export type ProbabilityVariable =
  'temperature' | 'wind_speed' | 'snow_level' | 'precipitation' | 'snowfall';

/** `ge`: at least the threshold. `le`: at most the threshold. */
export type ComparisonOp = 'ge' | 'le';

/**
 * How the hours of a window combine. `total` (the window total) is the only
 * one for precipitation and snowfall; `any` (the default) or `all` hours for
 * the others.
 */
export type Aggregation = 'total' | 'any' | 'all';

/**
 * A forecast window in hours from the first served hour: `{ hours: 24 }` is
 * hours 0..24, `{ startHours: 6, endHours: 18 }` is hours 6..18. A bare number
 * is shorthand for `{ hours: n }`. The default is 24 h; the maximum is 360 h.
 */
export type Window =
  number | { readonly hours: number } | { readonly startHours: number; readonly endHours: number };

/** One probability question: "the chance that `variable` is `op` `threshold` over `window`". */
export interface ProbabilityTerm {
  readonly variable: ProbabilityVariable;
  readonly op: ComparisonOp;
  /** A number in the request's units, or a value with its own unit (converted exactly). */
  readonly threshold: number | Threshold;
  /** Defaults to the next 24 hours. */
  readonly window?: Window;
  /** Defaults to `total` for precipitation and snowfall and `any` for the others. */
  readonly aggregation?: Aggregation;
}

/** Options shared by {@link atLeast} and {@link atMost}. */
export interface TermOptions {
  readonly window?: Window;
  readonly aggregation?: Aggregation;
}

/**
 * The chance that `variable` reaches at least `threshold`.
 *
 * @example
 * ```ts
 * atLeast('snowfall', inches(6), { window: { hours: 24 } })
 * ```
 */
export function atLeast(
  variable: ProbabilityVariable,
  threshold: number | Threshold,
  options: TermOptions = {},
): ProbabilityTerm {
  return { variable, op: 'ge', threshold, ...options };
}

/**
 * The chance that `variable` stays at most `threshold`.
 *
 * @example
 * ```ts
 * atMost('temperature', fahrenheit(32), { window: { startHours: 6, endHours: 18 }, aggregation: 'all' })
 * ```
 */
export function atMost(
  variable: ProbabilityVariable,
  threshold: number | Threshold,
  options: TermOptions = {},
): ProbabilityTerm {
  return { variable, op: 'le', threshold, ...options };
}

/** A variable a window total can be asked for. */
export type TotalVariable = 'precipitation' | 'snowfall';

/** One window-total question: the distribution of each member's total over `window`. */
export interface TotalTerm {
  readonly variable: TotalVariable;
  /** Defaults to the next 24 hours. */
  readonly window?: Window;
}

/**
 * The distribution of the `variable` total over `window` (a storm total).
 *
 * @example
 * ```ts
 * windowTotal('snowfall', { hours: 72 })
 * ```
 */
export function windowTotal(variable: TotalVariable, window?: Window): TotalTerm {
  return window === undefined ? { variable } : { variable, window };
}

// ---------------------------------------------------------------------------
// Wire form (internal)

const DIMENSION: Readonly<Record<ProbabilityVariable, Dimension>> = {
  temperature: 'temperature',
  wind_speed: 'speed',
  snow_level: 'height',
  precipitation: 'depth',
  snowfall: 'depth',
};

const VARIABLES = Object.keys(DIMENSION) as ProbabilityVariable[];
const AGGREGATION_ORDER: readonly Aggregation[] = ['total', 'any', 'all'];
const MAX_WINDOW_HOURS = 360;

function isAmount(variable: ProbabilityVariable): boolean {
  return variable === 'precipitation' || variable === 'snowfall';
}

/** Decimal places the server serves (and rounds thresholds to) for a variable. */
function precision(variable: ProbabilityVariable, units: UnitSystem): number {
  if (isAmount(variable)) return units === 'imperial' ? 3 : 2;
  return variable === 'snow_level' ? 0 : 1;
}

/**
 * `round_half_away_from_zero(v * 10^d) / 10^d` in IEEE-754 doubles, printed
 * with exactly `d` decimals and without a negative zero (BEHAVIOR.md section 4).
 * `Math.round` on the magnitude is exact, so 1.005 at d = 2 gives 1.00 (since
 * 1.005 * 100 is 100.49999...) and 0.0625 at d = 3 gives 0.063.
 */
export function roundThreshold(value: number, decimals: number): string {
  if (!Number.isFinite(value)) throw new UsageError(`Threshold ${String(value)} is not finite.`);
  const scaled = value * 10 ** decimals;
  const magnitude = Math.round(Math.abs(scaled));
  let digits = magnitude < 1e21 ? magnitude.toString() : BigInt(magnitude).toString();
  if (decimals > 0) {
    digits = digits.padStart(decimals + 1, '0');
    digits = `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
  }
  return magnitude !== 0 && scaled < 0 ? `-${digits}` : digits;
}

interface WindowSpan {
  readonly start: number;
  readonly end: number;
}

function windowSpan(window: Window | undefined, what: string): WindowSpan {
  let start: number;
  let end: number;
  if (window === undefined) {
    start = 0;
    end = 24;
  } else if (typeof window === 'number') {
    start = 0;
    end = window;
  } else if ('hours' in window) {
    start = 0;
    end = window.hours;
  } else {
    start = window.startHours;
    end = window.endHours;
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > MAX_WINDOW_HOURS
  ) {
    throw new UsageError(
      `${what}: a window is whole hours with 0 <= start < end <= ${String(MAX_WINDOW_HOURS)}; got ${String(start)}..${String(end)}.`,
    );
  }
  return { start, end };
}

function windowText({ start, end }: WindowSpan): string {
  return start === 0 ? `${String(end)}h` : `${String(start)}-${String(end)}h`;
}

/**
 * @internal A term in canonical wire form. `text` is its canonical spelling:
 * the server echoes it as the result's `term`, so it is also the mapping key.
 */
export interface WireTerm {
  readonly text: string;
  readonly variable: string;
  readonly op: string;
  readonly window: WindowSpan;
  readonly aggregation: Aggregation;
  readonly threshold: number;
}

/** @internal Validates, converts and rounds one probability term. */
export function wireProbabilityTerm(term: ProbabilityTerm, units: UnitSystem): WireTerm {
  const what = `prob term ${JSON.stringify(term)}`;
  // Runtime checks too: JavaScript callers have no type checker.
  const variable: string = term.variable;
  const op: string = term.op;
  if (!(VARIABLES as readonly string[]).includes(variable)) {
    throw new UsageError(`${what}: unknown variable '${variable}'.`);
  }
  if (op !== 'ge' && op !== 'le') {
    throw new UsageError(`${what}: op must be 'ge' (at least) or 'le' (at most).`);
  }
  const defaultAggregation: Aggregation = isAmount(term.variable) ? 'total' : 'any';
  const aggregation = term.aggregation ?? defaultAggregation;
  if (isAmount(term.variable) ? aggregation !== 'total' : aggregation === 'total') {
    throw new UsageError(
      isAmount(term.variable)
        ? `${what}: ${term.variable} takes only the 'total' aggregation (the window total).`
        : `${what}: '${aggregation}' is not an aggregation for ${term.variable}; use 'any' or 'all'.`,
    );
  }
  if (!AGGREGATION_ORDER.includes(aggregation)) {
    throw new UsageError(`${what}: unknown aggregation '${aggregation}'.`);
  }
  const value = convertThreshold(term.threshold, DIMENSION[term.variable], units, what);
  const threshold = roundThreshold(value, precision(term.variable, units));
  const window = windowSpan(term.window, what);
  const parts = [term.variable, term.op, threshold, windowText(window)];
  if (aggregation !== defaultAggregation) parts.push(aggregation);
  return {
    text: parts.join(':'),
    variable: term.variable,
    op: term.op,
    window,
    aggregation,
    threshold: Number(threshold),
  };
}

function compareTerms(a: WireTerm, b: WireTerm): number {
  return (
    cmp(a.variable, b.variable) ||
    cmp(a.op, b.op) ||
    a.window.start - b.window.start ||
    a.window.end - b.window.end ||
    AGGREGATION_ORDER.indexOf(a.aggregation) - AGGREGATION_ORDER.indexOf(b.aggregation) ||
    a.threshold - b.threshold
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @internal The terms of a request: their canonical spellings in caller order
 * (for mapping results back by `term`) and the canonical query value.
 */
export interface WireTerms {
  readonly callerKeys: readonly string[];
  readonly query: string;
}

/** @internal Builds the canonical `prob` value: de-duplicated, sorted, `,`-joined. */
export function wireProbabilities(terms: readonly ProbabilityTerm[], units: UnitSystem): WireTerms {
  const wire = terms.map((t) => wireProbabilityTerm(t, units));
  return { callerKeys: wire.map((w) => w.text), query: canonicalJoin(wire) };
}

function canonicalJoin(wire: readonly WireTerm[]): string {
  const unique = new Map<string, WireTerm>();
  for (const w of wire) if (!unique.has(w.text)) unique.set(w.text, w);
  return [...unique.values()]
    .sort(compareTerms)
    .map((w) => w.text)
    .join(',');
}

/** @internal Builds the canonical `totals` value. */
export function wireTotals(terms: readonly TotalTerm[]): WireTerms {
  const wire = terms.map((term): WireTerm => {
    const what = `totals term ${JSON.stringify(term)}`;
    const variable: string = term.variable;
    if (variable !== 'precipitation' && variable !== 'snowfall') {
      throw new UsageError(
        `${what}: window totals are served for 'precipitation' and 'snowfall' only.`,
      );
    }
    const window = windowSpan(term.window, what);
    return {
      text: `${term.variable}:${windowText(window)}`,
      variable: term.variable,
      op: '',
      window,
      aggregation: 'total',
      threshold: 0,
    };
  });
  return { callerKeys: wire.map((w) => w.text), query: canonicalJoin(wire) };
}
