#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// SDK-STANDARD "Dependencies": the package has ZERO runtime dependencies, and
// the justification list in CONTRIBUTING.md matches the manifest exactly.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const contributing = readFileSync(join(root, 'CONTRIBUTING.md'), 'utf8');

const runtime = new Set();
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const name of Object.keys(pkg[field] ?? {})) runtime.add(name);
}
for (const name of pkg.bundleDependencies ?? pkg.bundledDependencies ?? []) runtime.add(name);

const section =
  /<!-- runtime-dependencies:start -->([\s\S]*?)<!-- runtime-dependencies:end -->/.exec(
    contributing,
  );
if (section === null) {
  console.error('CONTRIBUTING.md has no runtime-dependencies list.');
  process.exit(1);
}
const justified = new Set([...section[1].matchAll(/^- `([^`]+)`: \S/gm)].map((m) => m[1]));

const problems = [];
for (const name of runtime) {
  problems.push(
    `runtime dependency '${name}' is not allowed (the SDK has zero runtime dependencies)`,
  );
  if (!justified.has(name))
    problems.push(`runtime dependency '${name}' has no justification line in CONTRIBUTING.md`);
}
for (const name of justified) {
  if (!runtime.has(name))
    problems.push(`CONTRIBUTING.md justifies '${name}', which is not a dependency`);
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('runtime dependencies: 0 (as required)');
