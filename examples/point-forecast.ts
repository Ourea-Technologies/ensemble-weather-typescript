// A forecast at coordinates with an elevation (Pro). Reads the key from
// OUREA_API_KEY and exits quietly without one.
import { Ourea, median } from 'ensemble-weather';

if (!process.env.OUREA_API_KEY) {
  console.log('point-forecast: set OUREA_API_KEY to a Pro key to run this example; skipping.');
  process.exit(0);
}

const ourea = new Ourea();
const forecast = await ourea.getPointForecast(
  { lat: 45.3311, lon: -121.6649, elevationM: 1661 },
  { maxHours: 48 },
);

console.log(
  `Resolved to ${String(forecast.point?.lat)}, ${String(forecast.point?.lon)} at ${String(forecast.point?.elevation)} m`,
);
for (const hour of forecast.forecast.timeseries?.slice(0, 6) ?? []) {
  console.log(
    `  ${hour.validTime}  median ${String(median(hour.ensemble.temperature))} ${forecast.units}  ${hour.conditionText}`,
  );
}
