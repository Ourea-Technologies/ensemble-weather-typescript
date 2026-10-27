// Window totals: the distribution of each member's own precipitation and
// snowfall total over a window. This is the storm total; never sum hourly
// quantiles yourself.
import { Ourea, range, windowTotal } from 'ensemble-weather';

const ourea = new Ourea();
const forecast = await ourea.getForecast('or/mt-hood-meadows', {
  totals: [windowTotal('precipitation', { hours: 48 }), windowTotal('snowfall', { hours: 72 })],
});

for (const total of forecast.windowTotals ?? []) {
  const window = `${String(total.windowStartHours)}-${String(total.windowEndHours)} h`;
  const r = total.quantiles === null ? undefined : range(total.quantiles, 'p10', 'p90');
  console.log(
    r === undefined
      ? `${total.variable} ${window}: not covered by this run`
      : `${total.variable} ${window}: ${String(r.low)} to ${String(r.high)} (p10-p90), median ${String(total.quantiles?.p50)}, ${String(total.members)} members`,
  );
}
