// SPDX-License-Identifier: BSD-2-Clause
// Response keys arrive in snake_case and are exposed in camelCase. Values are
// never touched. Free-form maps (whose keys are data, not field names) are
// passed through as they are.

/** Fields whose value is a free-form map, copied verbatim. */
const OPAQUE_FIELDS: ReadonlySet<string> = new Set([
  'body',
  'config',
  'external_links',
  'last_report_summary',
]);

/** `elevation_m` -> `elevationM`, `next_24h` -> `next24h`. */
export function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Deep-copies parsed JSON with camelCase keys. JSON.parse output is plain
 * data, so this never invokes user code or builds class instances.
 */
export function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // defineProperty, not assignment: a `__proto__` key in the body stays a
    // plain data property and never changes the object's prototype.
    Object.defineProperty(out, camelKey(k), {
      value: OPAQUE_FIELDS.has(k) ? v : camelize(v),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}
