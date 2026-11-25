#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Generates src/internal/renames.ts from the pinned spec: for each operation,
// the path from its response schema down to every field BEHAVIOR.md 3.0
// renames, so the decoder can give those fields their SDK names (and leave
// every other key alone).
//
//   node scripts/gen-renames.mjs           write the file
//   node scripts/gen-renames.mjs --check   fail if it is out of date (CI)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadRenames } from './renames-table.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src', 'internal', 'renames.ts');
const spec = parse(readFileSync(join(root, 'spec', 'openapi', 'v1', 'openapi.yaml'), 'utf8'));
const schemas = spec.components.schemas;
const specVersion = readFileSync(join(root, 'spec', 'VERSION'), 'utf8').trim();
const renames = loadRenames(root, schemas);
const camel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const refName = (ref) => ref.split('/').pop();

// node id -> { label, properties } for component schemas and inline objects.
const nodes = new Map();
function props(schema) {
  if (schema.$ref) return props(schemas[refName(schema.$ref)]);
  const out = { ...(schema.properties ?? {}) };
  for (const part of schema.allOf ?? []) Object.assign(out, props(part));
  return out;
}
/** The node a field's value decodes as, or undefined for a scalar. */
function childOf(owner, field, node) {
  if (node === undefined) return undefined;
  if (node.$ref) return refName(node.$ref);
  if (node.type === 'array' || (Array.isArray(node.type) && node.type.includes('array')))
    return childOf(owner, field, node.items);
  for (const k of ['anyOf', 'oneOf', 'allOf']) {
    if (!node[k]) continue;
    const alts = node[k].filter((s) => s.type !== 'null');
    if (k === 'oneOf' && alts.length > 1) {
      const id = `${owner}.${field}`;
      nodes.set(id, { label: id, union: alts.map((a) => childOf(owner, field, a)) });
      return id;
    }
    if (alts.length === 1) return childOf(owner, field, alts[0]);
  }
  if (node.properties) {
    const id = `${owner}.${field}`;
    if (!nodes.has(id)) nodes.set(id, { label: id, properties: node.properties });
    return id;
  }
  return undefined;
}
for (const [name, schema] of Object.entries(schemas)) {
  if (schema.oneOf) {
    nodes.set(name, { label: name, union: schema.oneOf.map((s) => refName(s.$ref)) });
  } else nodes.set(name, { label: name, properties: props(schema) });
}
// Resolve every node's fields, then keep the nodes that lead to a rename.
const edges = new Map(); // id -> { camelWire: childId }
let pending = [...nodes.keys()];
while (pending.length > 0) {
  const next = [];
  for (const id of pending) {
    const node = nodes.get(id);
    if (node.properties === undefined) continue;
    const before = nodes.size;
    const e = {};
    for (const [field, value] of Object.entries(node.properties)) {
      const child = childOf(node.label.split('.')[0] === id ? id : id, field, value);
      if (child !== undefined) e[camel(field)] = child;
    }
    edges.set(id, e);
    if (nodes.size > before) next.push(...[...nodes.keys()].slice(before));
  }
  pending = next;
}
const own = (id) => renames.get(id);
const needed = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const [id, node] of nodes) {
    if (needed.has(id)) continue;
    const kids = node.union ?? Object.values(edges.get(id) ?? {});
    if (own(id) || kids.some((k) => needed.has(k))) {
      needed.add(id);
      changed = true;
    }
  }
}
// The operations' JSON response schemas. GeoJSON bodies (application/geo+json)
// are passed through untouched (BEHAVIOR.md 3.0), so they start no renames.
const roots = {};
for (const item of Object.values(spec.paths)) {
  const op = item.get;
  if (!op) continue;
  const ref = op.responses?.['200']?.content?.['application/json']?.schema?.$ref;
  if (ref && needed.has(refName(ref))) roots[op.operationId] = refName(ref);
}
// Keep only the nodes an operation reaches.
const reached = new Set();
const visit = (id) => {
  if (reached.has(id) || !needed.has(id)) return;
  reached.add(id);
  const node = nodes.get(id);
  for (const k of node.union ?? Object.values(edges.get(id) ?? {})) visit(k);
};
for (const id of Object.values(roots)) visit(id);
const table = {};
for (const id of [...reached].sort()) {
  const node = nodes.get(id);
  const entry = {};
  if (node.union) entry.union = node.union.filter((k) => needed.has(k));
  const r = own(id);
  if (r) entry.rename = Object.fromEntries([...r].map(([w, s]) => [camel(w), camel(s)]));
  const kids = Object.entries(edges.get(id) ?? {}).filter(([, k]) => needed.has(k));
  if (kids.length > 0) entry.fields = Object.fromEntries(kids);
  table[id] = entry;
}

const text = `// SPDX-License-Identifier: BSD-2-Clause
// GENERATED by scripts/gen-renames.mjs from spec/openapi/v1/openapi.yaml and
// spec/BEHAVIOR.md section 3.0 (ensemble-weather-spec@${specVersion}). Do not edit.
//
// The wire fields the SDKs name differently, and the paths that lead to them.

/** One schema: its renamed keys, the keys that lead to more, or its oneOf variants. */
export interface RenameNode {
  readonly rename?: Readonly<Record<string, string>>;
  readonly fields?: Readonly<Record<string, string>>;
  readonly union?: readonly string[];
}

export const RENAME_NODES: Readonly<Record<string, RenameNode>> = ${JSON.stringify(table, null, 2)};

/** operationId -> the response schema its renames start from. */
export const RENAME_ROOTS: Readonly<Record<string, string>> = ${JSON.stringify(roots, null, 2)};
`;
const prettier = join(root, 'node_modules', '.bin', 'prettier');
const formatted = execFileSync(prettier, ['--stdin-filepath', outPath], { input: text }).toString();
if (process.argv.includes('--check')) {
  if (readFileSync(outPath, 'utf8') !== formatted) {
    console.error('src/internal/renames.ts is out of date: run `npm run gen:renames`.');
    process.exit(1);
  }
  console.log(`renames are current (${String(Object.keys(table).length)} schemas).`);
} else {
  writeFileSync(outPath, formatted);
  console.log(`wrote ${outPath} (${String(Object.keys(table).length)} schemas).`);
}
