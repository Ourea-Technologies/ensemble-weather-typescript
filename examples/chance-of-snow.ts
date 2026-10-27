// Several probability terms in one call. The server computes each from the
// full ensemble; every answer carries its window and how many members voted.
import { Ourea, atLeast, atMost, fahrenheit, inches, mph } from 'ensemble-weather';

const ourea = new Ourea({ units: 'imperial' });
const forecast = await ourea.getForecast('or/mt-hood-meadows', {
  maxHours: 72,
  prob: [
    atLeast('snowfall', inches(6), { window: { hours: 24 } }),
    atLeast('snowfall', inches(12), { window: { hours: 72 } }),
    atMost('temperature', fahrenheit(32), {
      window: { startHours: 6, endHours: 18 },
      aggregation: 'all',
    }),
    atLeast('wind_speed', mph(40), { window: { hours: 24 } }),
  ],
});

for (const p of forecast.probabilities ?? []) {
  const chance =
    p.probability === null ? 'not covered yet' : `${String(Math.round(p.probability * 100))}%`;
  const window = `${String(p.windowStartHours)}-${String(p.windowEndHours)} h`;
  console.log(
    `${p.variable} ${p.op} ${String(p.threshold)} (${p.aggregation}, ${window}): ${chance} of ${String(p.members)} members`,
  );
}
