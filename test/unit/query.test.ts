// SPDX-License-Identifier: BSD-2-Clause
import { describe, expect, it } from 'vitest';
import { UsageError } from '../../src/index.js';
import { encodeRfc3986, formatNumber, QueryBuilder } from '../../src/internal/query.js';

describe('encodeRfc3986', () => {
  it('leaves unreserved characters and encodes the rest in uppercase hex', () => {
    expect(encodeRfc3986('AZaz09-._~')).toBe('AZaz09-._~');
    expect(encodeRfc3986("a b+c!'()*:,/?#[]@&=")).toBe(
      'a%20b%2Bc%21%27%28%29%2A%3A%2C%2F%3F%23%5B%5D%40%26%3D',
    );
    expect(encodeRfc3986('ñ')).toBe('%C3%B1');
  });

  it('rejects an unpaired surrogate as a usage error', () => {
    expect(() => encodeRfc3986('\uD800')).toThrow(UsageError);
  });
});

describe('formatNumber', () => {
  it.each([
    [45.3311, '45.3311'],
    [-121.6649, '-121.6649'],
    [1661, '1661'],
    [0, '0'],
    [-0, '0'],
    [1e-7, '0.0000001'],
    [-1.5e-7, '-0.00000015'],
    [1e21, '1000000000000000000000'],
    [1.23e22, '12300000000000000000000'],
    [0.1 + 0.2, '0.30000000000000004'],
  ])('%s -> %s', (n, text) => {
    expect(formatNumber(n)).toBe(text);
  });

  it('refuses non-finite numbers', () => {
    expect(() => formatNumber(Number.NaN)).toThrow(UsageError);
    expect(() => formatNumber(Infinity)).toThrow(UsageError);
  });
});

describe('QueryBuilder', () => {
  it('omits defaults and absent values, sorts by name, writes booleans as true/false', () => {
    const q = new QueryBuilder()
      .set('units', 'metric', 'metric')
      .set('nowcast', false, true)
      .set('max_hours', 24, 24)
      .set('cursor', undefined)
      .set('include_past', true, false)
      .list('sources', ['snotel', 'raws'])
      .list('empty', []);
    expect(q.toString()).toBe('include_past=true&nowcast=false&sources=snotel%2Craws');
  });

  it('sorts and de-duplicates a comma list', () => {
    expect(new QueryBuilder().sortedList('capability', ['swe', 'air_temp', 'swe']).toString()).toBe(
      'capability=air_temp%2Cswe',
    );
  });

  it('is empty when nothing is set', () => {
    expect(new QueryBuilder().toString()).toBe('');
  });
});
