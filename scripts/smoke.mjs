#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Imports the built package under every runtime available here: Node (ESM and
// CommonJS) always, Deno and Bun when installed (CI installs both). A missing
// runtime is reported and skipped, never silently. Run `npm run build` first.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const esm = join(root, 'test', 'smoke', 'smoke.mjs');
const cjs = join(root, 'test', 'smoke', 'smoke.cjs');

const runs = [
  ['node (ESM)', process.execPath, [esm]],
  ['node (CommonJS)', process.execPath, [cjs]],
  ['deno', 'deno', ['run', '--no-prompt', '--allow-read', esm]],
  ['bun', 'bun', ['run', esm]],
];

// CI passes --require-all: there a missing runtime is a failure, not a skip.
const requireAll = process.argv.includes('--require-all');
let failed = 0;
for (const [label, command, args] of runs) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60_000 });
  if (result.error?.code === 'ENOENT') {
    if (requireAll) {
      failed++;
      console.log(`FAIL ${label}: '${command}' is not installed`);
    } else {
      console.log(`SKIP ${label}: '${command}' is not installed here (CI runs it).`);
    }
    continue;
  }
  const ok = result.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${(result.stdout + result.stderr).trim()}`);
}
process.exit(failed === 0 ? 0 : 1);
