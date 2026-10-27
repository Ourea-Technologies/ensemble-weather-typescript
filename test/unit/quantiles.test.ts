// SPDX-License-Identifier: BSD-2-Clause
import { describe, expect, it } from 'vitest';
import { median, range, UsageError, type Quantiles } from '../../src/index.js';

const q: Quantiles = { p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 };

describe('quantile views', () => {
  it('serves only the p10..p90 and p25..p75 ranges', () => {
    expect(range(q, 'p10', 'p90')).toEqual({ low: 1, high: 5 });
    expect(range(q, 'p25', 'p75')).toEqual({ low: 2, high: 4 });
    expect(() => range(q, 'p10' as 'p25', 'p75')).toThrow(UsageError);
  });

  it('is absent, not zero, when an end is missing', () => {
    expect(range({ p10: 1 }, 'p10', 'p90')).toBeUndefined();
    expect(median({})).toBeUndefined();
    expect(median(q)).toBe(3);
  });
});
