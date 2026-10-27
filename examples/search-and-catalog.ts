// Search for a location, then page through the catalog with its cursor.
import { Ourea } from 'ensemble-weather';

const ourea = new Ourea();
const hits = await ourea.searchLocations('hood meadows', { limit: 5 });
for (const hit of hits.items) console.log(`search: ${hit.key}  ${hit.name} (${hit.county} County)`);

// Await a list call for one page, or iterate it to follow next_cursor lazily.
const first = await ourea.listCatalogLocations({ admin1: 'US-OR', limit: 20 });
console.log(
  `first page: ${String(first.items.length)} locations, next cursor ${String(first.nextCursor)}`,
);

let n = 0;
for await (const location of ourea.listCatalogLocations({ admin1: 'US-OR', limit: 20 })) {
  n++;
  console.log(`catalog ${String(n)}: ${location.slug}`);
  if (n >= 100) break;
}
