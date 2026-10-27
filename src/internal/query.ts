// SPDX-License-Identifier: BSD-2-Clause
// Canonical query strings (BEHAVIOR.md section 3.1). One request has exactly
// one spelling, so it has exactly one edge-cache entry.

import { UsageError } from '../errors.js';

/**
 * RFC 3986 percent-encoding: unreserved characters stay, everything else is
 * `%XX` in uppercase hex, and a space is `%20`, never `+`. `URLSearchParams`
 * does not do this (it writes `+` and leaves `*` alone), so we never use it.
 */
export function encodeRfc3986(value: string): string {
  let encoded: string;
  try {
    encoded = encodeURIComponent(value);
  } catch {
    throw new UsageError('A query or path value contains an unpaired UTF-16 surrogate.');
  }
  return encoded.replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );
}

/**
 * The shortest decimal that round-trips to `n`, never in exponent notation.
 * JavaScript's own `String(n)` is shortest round-trip but switches to
 * exponents below 1e-6 and from 1e21.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new UsageError(`${String(n)} is not a finite number.`);
  if (n === 0) return '0';
  const s = String(n);
  const e = s.indexOf('e');
  if (e === -1) return s;
  // String(n) is `[-]d[.ddd]e[+-]x` here.
  const sign = s.startsWith('-') ? '-' : '';
  const [lead = '', frac = ''] = s.slice(sign.length, e).split('.');
  const exp = Number(s.slice(e + 1));
  const digits = lead + frac;
  if (exp < 0) return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`;
  return sign + digits + '0'.repeat(exp - frac.length);
}

type Scalar = string | number | boolean;

function scalarText(value: Scalar): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

/** Accumulates query parameters and writes them in canonical form. */
export class QueryBuilder {
  readonly #pairs: [name: string, encoded: string][] = [];

  /**
   * Adds `name=value` unless the value is absent or equal to the route's
   * default (a parameter at its default is never sent).
   */
  set(name: string, value: Scalar | undefined, defaultValue?: Scalar): this {
    if (value === undefined) return this;
    if (defaultValue !== undefined && scalarText(value) === scalarText(defaultValue)) return this;
    this.#pairs.push([name, encodeRfc3986(scalarText(value))]);
    return this;
  }

  /** Adds a comma-separated list (encoded as one value), omitted when empty. */
  list(name: string, values: readonly string[] | undefined, defaultValue?: string): this {
    if (values === undefined || values.length === 0) return this;
    return this.set(name, values.join(','), defaultValue);
  }

  /** Adds a parameter the caller has already encoded (`prob`, `totals`). */
  raw(name: string, encoded: string | undefined): this {
    if (encoded !== undefined && encoded !== '') this.#pairs.push([name, encoded]);
    return this;
  }

  /** Adds a repeated parameter (`capability=a&capability=b`), sorted and de-duplicated. */
  repeated(name: string, values: readonly string[] | undefined): this {
    if (values === undefined) return this;
    for (const v of [...new Set(values)].sort()) this.#pairs.push([name, encodeRfc3986(v)]);
    return this;
  }

  /** The query string, without the leading `?`; empty when nothing is set. */
  toString(): string {
    return [...this.#pairs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  }
}
