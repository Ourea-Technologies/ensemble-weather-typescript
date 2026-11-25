// Current conditions and active alerts for a named location.
import { Ourea } from 'ensemble-weather';

const ourea = new Ourea();
const [current, alerts] = await Promise.all([
  ourea.getCurrent('or/mt-hood-meadows'),
  ourea.getAlerts('or/mt-hood-meadows'),
]);

if (current.now === null) {
  console.log('No current conditions are available right now.');
} else {
  const c = current.now;
  console.log(
    `${current.location.name} now: ${String(c.temperature)} (${current.units}), ${c.text}, wind ${String(c.windSpeed)} from ${String(c.windDirection)}°, source ${c.source}`,
  );
}
console.log(`${String(alerts.count)} active alert(s)`);
for (const alert of alerts.items)
  console.log(`  ${alert.severity}: ${alert.headline} (until ${alert.expires})`);
