// SPDX-License-Identifier: BSD-2-Clause
// The cross-SDK rename table of spec/BEHAVIOR.md section 3.0, parsed from the
// pinned spec: the wire fields every SDK names differently (they stutter in
// their holder). One source of truth for scripts/gen-renames.mjs (the runtime
// decoder table) and scripts/gen-spec-checks.mjs (the compile-time checks).
//
// loadRenames(root, schemas) -> Map<label, Map<wireSnake, sdkSnake>>, where a
// label is a component schema name or an inline path (`Schema.field`).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADER = '| Schema (where the field sits) | Wire name | SDK name |';

export function loadRenames(root, schemas) {
  const text = readFileSync(join(root, 'spec', 'BEHAVIOR.md'), 'utf8');
  const start = text.indexOf(HEADER);
  if (start === -1) throw new Error('BEHAVIOR.md has no rename table');
  const lines = text.slice(start).split('\n').slice(2);
  const out = new Map();
  for (const line of lines) {
    if (!line.startsWith('|')) break;
    const [, holders, wires, sdks] = line.split('|').map((c) => c.trim());
    const tick = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const wireNames = tick(wires);
    const sdkNames = tick(sdks.replace(/\(.*\)/, ''));
    if (wireNames.length !== sdkNames.length) throw new Error(`rename row ${line}`);
    if (wireNames[0] === 'error') continue; // ErrorResponse: the error's `code`
    for (let holder of tick(holders).filter((h) => /^[A-Z]/.test(h))) {
      holder = holder.replace(/\[\]$/, '');
      // A oneOf schema (FreezingLevel): the variants that carry the field.
      const schema = schemas[holder];
      const labels = schema?.oneOf
        ? schema.oneOf
            .map((v) => v.$ref.split('/').pop())
            .filter((n) => wireNames.some((w) => w in (schemas[n].properties ?? {})))
        : [holder];
      for (const label of labels) {
        const map = out.get(label) ?? new Map();
        wireNames.forEach((w, i) => map.set(w, sdkNames[i]));
        out.set(label, map);
      }
    }
  }
  return out;
}
