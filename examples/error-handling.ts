// Catch an out-of-coverage error by its type and code, and read the
// rate-limit state the API reports.
import { OutsideCoverageError, Ourea, OureaError, PermissionError } from 'ensemble-weather';

const ourea = new Ourea({ maxRetries: 2 });

try {
  await ourea.getPointForecast({ lat: 51.5, lon: -0.1 }); // London: outside the CONUS domain
} catch (error) {
  if (error instanceof OutsideCoverageError) {
    console.log(`Outside coverage, HTTP ${String(error.status)}: ${error.message}`);
  } else if (error instanceof PermissionError) {
    console.log(`Point forecasts need a Pro key (${String(error.code)}).`);
  } else if (error instanceof OureaError) {
    console.log(`Other Ourea error, category ${error.category}: ${error.message}`);
  } else {
    throw error;
  }
}

const forecast = await ourea.getForecast('or/mt-hood-meadows');
const limit = forecast.meta.rateLimit ?? ourea.rateLimit;
console.log(
  limit === undefined
    ? 'No rate-limit headers on this response (an edge-cacheable anonymous response carries none).'
    : `Rate limit: ${String(limit.remaining)} of ${String(limit.limit)} left, resets in ${String(limit.reset)} s (${String(limit.policy)})`,
);
