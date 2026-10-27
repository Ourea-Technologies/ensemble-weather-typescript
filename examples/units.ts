// The same forecast in metric and imperial. The server converts; the SDK
// never converts response values.
import { Ourea, range } from 'ensemble-weather';

const metric = new Ourea();
const imperial = metric.withOptions({ units: 'imperial' });

for (const client of [metric, imperial]) {
  const forecast = await client.getForecast('or/mt-hood-meadows');
  const hour = forecast.forecast.timeseries?.[0];
  if (hour === undefined) continue;
  const t = range(hour.ensemble.temperature, 'p10', 'p90');
  const p = range(hour.ensemble.precipitation, 'p10', 'p90');
  console.log(
    `${forecast.units}: temperature ${String(t?.low)} to ${String(t?.high)}, precipitation ${String(p?.low)} to ${String(p?.high)}, wind median ${String(hour.ensemble.windSpeed.p50)}`,
  );
}
