// Where is it snowing? Rank places by the next five days' snowfall, then read
// one place's season to date and its run-by-run snow trend (Plus or Pro).
import { Ourea, PermissionError } from 'ensemble-weather';

const ourea = new Ourea({ units: 'imperial' });

const ranked = await ourea.explore('snow_5d', { limit: 5 });
console.log(`Most snow in the next 5 days (${ranked.unit}):`);
for (const item of ranked.items) {
  const range = item.p10 === undefined ? '' : ` (${String(item.p10)} to ${String(item.p90)})`;
  console.log(
    `  ${String(item.rank)}. ${item.location.name}, ${item.location.state.toUpperCase()}: ${String(item.value)}${range}`,
  );
}

const season = await ourea.getSeason('or/mt-hood-meadows');
console.log(
  `\nWater year ${String(season.waterYear)} at ${season.location.name}, through ${season.through}:`,
);
if (season.precipitation !== null) {
  const p = season.precipitation;
  const normal = p.percentOfNormal === null ? '' : `, ${String(p.percentOfNormal)}% of normal`;
  console.log(`  precipitation ${String(p.total)} ${p.unit}${normal}`);
}

try {
  const trend = await ourea.getSnowTrend('or/mt-hood-meadows');
  const grid = trend.grids[0];
  const newest = grid?.runs.at(-1);
  if (grid !== undefined && newest !== undefined) {
    console.log(`\nSnow trend (${grid.source}), newest run ${newest.initializedAt}:`);
    for (const day of newest.days)
      if (day !== null) console.log(`  ${day.date}: ${String(day.snow)}`);
  }
} catch (error) {
  if (!(error instanceof PermissionError)) throw error;
  console.log('\nThe snow trend is part of Plus and Pro (set OUREA_API_KEY).');
}
