// Current conditions and active alerts for a named location.
import { Ourea } from 'ensemble-weather';

const ourea = new Ourea();
const [now, alerts] = await Promise.all([
  ourea.getCurrent('or/mt-hood-meadows'),
  ourea.getAlerts('or/mt-hood-meadows'),
]);

if (now.current === null) {
  console.log('No current conditions are available right now.');
} else {
  const c = now.current;
  console.log(
    `${now.location.name} now: ${String(c.temperature)} (${now.units}), ${c.conditionText}, wind ${String(c.windSpeed)} from ${String(c.windDirection)}°, source ${c.source}`,
  );
}
console.log(`${String(alerts.alertCount)} active alert(s)`);
for (const alert of alerts.alerts)
  console.log(`  ${alert.severity}: ${alert.headline} (until ${alert.expires})`);
