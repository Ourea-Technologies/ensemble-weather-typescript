// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon (no API key).
// Prints the next 24 hours' temperature as a p10-p90 range, and the chance
// of at least 6 in (15 cm) of snow in the next 24 hours.
import { Ourea, atLeast, inches, range } from 'ensemble-weather';

const ourea = new Ourea();
const forecast = await ourea.getForecast('or/mt-hood-meadows', {
  prob: [atLeast('snowfall', inches(6), { window: { hours: 24 } })],
});

const degrees = forecast.units === 'imperial' ? '°F' : forecast.units === 'kelvin' ? 'K' : '°C';
console.log(`${forecast.location.name}: temperature over the next 24 h (p10 to p90)`);
for (const hour of forecast.forecast.timeseries?.slice(0, 25) ?? []) {
  const t = range(hour.ensemble.temperature, 'p10', 'p90');
  if (t) console.log(`  ${hour.validTime}  ${String(t.low)} to ${String(t.high)} ${degrees}`);
}

const snow = forecast.probabilities?.[0];
if (snow?.probability != null) {
  const percent = Math.round(snow.probability * 100);
  console.log(
    `Chance of 6 in (15 cm) or more of snow in the next 24 h: ${String(percent)}% (${String(snow.members)} members)`,
  );
} else {
  console.log('The chance of 6 in of snow is not available for this window yet.');
}
