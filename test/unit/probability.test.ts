// SPDX-License-Identifier: BSD-2-Clause
import { describe, expect, it } from 'vitest';
import {
  atLeast,
  atMost,
  celsius,
  centimeters,
  fahrenheit,
  feet,
  inches,
  kelvin,
  meters,
  metersPerSecond,
  millimeters,
  mph,
  UsageError,
  windowTotal,
  type ProbabilityTerm,
} from '../../src/index.js';
import {
  roundThreshold,
  wireProbabilities,
  wireProbabilityTerm,
  wireTotals,
} from '../../src/probability.js';

const text = (term: ProbabilityTerm, units: 'metric' | 'imperial' | 'kelvin' = 'metric'): string =>
  wireProbabilityTerm(term, units).text;

describe('roundThreshold (half away from zero, in doubles)', () => {
  it.each([
    [1.005, 2, '1.00'],
    [0.0625, 3, '0.063'],
    [-0.0625, 3, '-0.063'],
    [2.5, 0, '3'],
    [-2.5, 0, '-3'],
    [-0.04, 1, '0.0'],
    [-0, 1, '0.0'],
    [152.39999999999998, 2, '152.40'],
    [1524.4, 0, '1524'],
    [-5, 1, '-5.0'],
    [0.5, 0, '1'],
    [0.49999999999999994, 0, '0'],
  ])('%s at %s decimals -> %s', (v, d, out) => {
    expect(roundThreshold(v, d)).toBe(out);
  });
});

describe('probability terms', () => {
  it('builds the wire form with the window always sent and the default aggregation omitted', () => {
    expect(text(atLeast('snowfall', 6), 'imperial')).toBe('snowfall:ge:6.000:24h');
    expect(
      text(
        atMost('temperature', 0, { window: { startHours: 6, endHours: 18 }, aggregation: 'all' }),
      ),
    ).toBe('temperature:le:0.0:6-18h:all');
    expect(text(atLeast('wind_speed', 15, { window: { startHours: 0, endHours: 24 } }))).toBe(
      'wind_speed:ge:15.0:24h',
    );
    expect(text(atLeast('wind_speed', 15, { window: 48, aggregation: 'any' }))).toBe(
      'wind_speed:ge:15.0:48h',
    );
  });

  it('converts a threshold with its own unit into the request units, exactly', () => {
    expect(text(atLeast('snowfall', inches(6)))).toBe('snowfall:ge:152.40:24h');
    expect(text(atLeast('snowfall', centimeters(15)), 'imperial')).toBe('snowfall:ge:5.906:24h');
    expect(text(atLeast('precipitation', millimeters(25.4)), 'imperial')).toBe(
      'precipitation:ge:1.000:24h',
    );
    expect(text(atMost('temperature', fahrenheit(32)))).toBe('temperature:le:0.0:24h');
    expect(text(atMost('temperature', celsius(0)), 'imperial')).toBe('temperature:le:32.0:24h');
    expect(text(atMost('temperature', celsius(0)), 'kelvin')).toBe('temperature:le:273.2:24h');
    expect(text(atMost('temperature', kelvin(273.15)))).toBe('temperature:le:0.0:24h');
    expect(text(atMost('temperature', fahrenheit(32)), 'kelvin')).toBe('temperature:le:273.2:24h');
    expect(text(atLeast('wind_speed', mph(10)))).toBe('wind_speed:ge:4.5:24h');
    expect(text(atLeast('wind_speed', metersPerSecond(10)), 'imperial')).toBe(
      'wind_speed:ge:22.4:24h',
    );
    expect(text(atMost('snow_level', feet(5000)))).toBe('snow_level:le:1524:24h');
    expect(text(atMost('snow_level', meters(1524)), 'imperial')).toBe('snow_level:le:5000:24h');
  });

  it('refuses a unit of the wrong dimension, and an unknown unit', () => {
    expect(() => text(atLeast('snowfall', fahrenheit(32)))).toThrow(UsageError);
    expect(() => text(atLeast('temperature', { value: 1, unit: 'furlong' } as never))).toThrow(
      UsageError,
    );
  });

  it('refuses invalid aggregations before sending', () => {
    expect(() => text(atLeast('precipitation', 10, { aggregation: 'any' }))).toThrow(UsageError);
    expect(() => text(atLeast('snowfall', 10, { aggregation: 'all' }))).toThrow(UsageError);
    expect(() => text(atLeast('temperature', 10, { aggregation: 'total' }))).toThrow(UsageError);
    expect(() => text(atLeast('temperature', 10, { aggregation: 'most' as never }))).toThrow(
      UsageError,
    );
  });

  it('refuses invalid variables, ops and windows', () => {
    expect(() => text({ variable: 'humidity' as never, op: 'ge', threshold: 1 })).toThrow(
      UsageError,
    );
    expect(() => text({ variable: 'snowfall', op: 'gt' as never, threshold: 1 })).toThrow(
      UsageError,
    );
    for (const window of [
      0,
      361,
      1.5,
      { startHours: 10, endHours: 10 },
      { startHours: -1, endHours: 5 },
    ]) {
      expect(() => text(atLeast('snowfall', 1, { window }))).toThrow(UsageError);
    }
    expect(() => text(atLeast('snowfall', Number.NaN))).toThrow(UsageError);
  });

  it('de-duplicates and sorts into the canonical order, keeping caller keys', () => {
    const terms = [
      atLeast('wind_speed', 15, { window: { startHours: 12, endHours: 36 } }),
      atMost('temperature', -5),
      atLeast('temperature', -5),
      atLeast('snowfall', 2),
      atLeast('snowfall', 1),
      atLeast('snowfall', 1),
    ];
    const wire = wireProbabilities(terms, 'metric');
    expect(wire.query).toBe(
      'snowfall:ge:1.00:24h,snowfall:ge:2.00:24h,temperature:ge:-5.0:24h,temperature:le:-5.0:24h,wind_speed:ge:15.0:12-36h',
    );
    expect(wire.callerKeys).toHaveLength(6);
    expect(wire.callerKeys[4]).toBe(wire.callerKeys[5]);
  });

  it('sorts aggregations total, any, all after the window', () => {
    const wire = wireProbabilities(
      [atLeast('temperature', 1, { aggregation: 'all' }), atLeast('temperature', 1)],
      'metric',
    );
    expect(wire.query).toBe('temperature:ge:1.0:24h,temperature:ge:1.0:24h:all');
  });
});

describe('window totals', () => {
  it('sorts by variable then window, de-duplicates, and always sends the window', () => {
    const wire = wireTotals([
      windowTotal('snowfall', { hours: 240 }),
      windowTotal('precipitation', { startHours: 24, endHours: 48 }),
      windowTotal('precipitation'),
      windowTotal('precipitation', 24),
    ]);
    expect(wire.query).toBe('precipitation:24h,precipitation:24-48h,snowfall:240h');
    expect(wire.callerKeys).toHaveLength(4);
  });

  it('refuses a variable without window totals', () => {
    expect(() => wireTotals([{ variable: 'temperature' as never }])).toThrow(UsageError);
  });
});
