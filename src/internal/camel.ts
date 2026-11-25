// SPDX-License-Identifier: BSD-2-Clause
// Response keys arrive in snake_case and are exposed in camelCase. Values are
// never touched. Free-form maps (whose keys are data, not field names) are
// passed through as they are.

import { RENAME_NODES } from './renames.js';

/** Fields whose value is a free-form map, copied verbatim. */
const OPAQUE_FIELDS: ReadonlySet<string> = new Set([
  'body',
  'config',
  'external_links',
  'last_report_summary',
  // SnowpackResponse.definitions: code -> text maps whose keys are data.
  'layer_form',
  'surface',
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

/**
 * Gives the wire fields BEHAVIOR.md 3.0 renames their SDK names, in place, on
 * a camelized body: `forecast` -> `series`, `probability` -> `value`, ... The
 * table and the paths to it are generated from the spec (./renames.ts).
 */
/* eslint-disable security/detect-object-injection -- every key comes from the generated table or the body's own keys, checked with Object.hasOwn */
export function applyRenames(value: unknown, node: string | undefined): unknown {
  if (node === undefined) return value;
  const spec = RENAME_NODES[node];
  if (spec === undefined || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const item of value) applyRenames(item, node);
    return value;
  }
  for (const variant of spec.union ?? []) applyRenames(value, variant);
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(spec.fields ?? {})) {
    if (Object.hasOwn(record, key)) applyRenames(record[key], child);
  }
  for (const [wire, sdk] of Object.entries(spec.rename ?? {})) {
    if (!Object.hasOwn(record, wire)) continue;
    Object.defineProperty(record, sdk, {
      value: record[wire],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- the key is from the generated table
    delete record[wire];
  }
  return value;
}
/* eslint-enable security/detect-object-injection */
