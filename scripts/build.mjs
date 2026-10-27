#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Dual build with plain tsc: dist/esm (ES modules) and dist/cjs (CommonJS),
// each with its own type declarations.

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(join(root, 'dist'), { recursive: true, force: true });
for (const project of ['tsconfig.build.json', 'tsconfig.cjs.json']) {
  execFileSync(process.execPath, [tsc, '-p', join(root, project)], { stdio: 'inherit' });
}
// Mark each tree's module format, so Node and TypeScript read .js / .d.ts right.
writeFileSync(join(root, 'dist', 'esm', 'package.json'), '{ "type": "module" }\n');
writeFileSync(join(root, 'dist', 'cjs', 'package.json'), '{ "type": "commonjs" }\n');
console.log('built dist/esm and dist/cjs');
