#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Runs every program in examples/ against the local mock API (never the real
// one), importing the BUILT package as a user would. Run `npm run build` first.
// The Pro-only example runs twice: without a key (it must skip and exit 0)
// and with a mock key.

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockServer } from './mock-server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = readdirSync(join(root, 'examples'))
  .filter((f) => f.endsWith('.ts'))
  .sort();
// Node 22.6+ strips TypeScript types behind a flag; 23.6+ does it by default.
const [major, minor] = process.versions.node.split('.').map(Number);
const flags =
  major < 23 || (major === 23 && minor < 6) ? ['--experimental-strip-types', '--no-warnings'] : [];

const mock = await startMockServer();
const env = { ...process.env, OUREA_BASE_URL: mock.url };
delete env.OUREA_API_KEY;

const runs = examples.map((file) => ({ file, env }));
runs.push({ file: 'point-forecast.ts', env: { ...env, OUREA_API_KEY: 'ow_mock_pro_key' } });

let failed = 0;
for (const { file, env: runEnv } of runs) {
  const label = `${file}${runEnv.OUREA_API_KEY ? ' (mock key)' : ''}`;
  const result = await new Promise((resolve) => {
    // Asynchronous: a synchronous spawn would block the mock server in this process.
    {
      const child = spawn(process.execPath, [...flags, join(root, 'examples', file)], {
        cwd: root,
        env: runEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, out });
      });
    }
  });
  const ok = result.code === 0 && result.out.trim() !== '';
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  console.log(result.out.replace(/^/gm, '    ').trimEnd());
}
await mock.close();
console.log(`${String(runs.length - failed)}/${String(runs.length)} example runs passed`);
process.exit(failed === 0 ? 0 : 1);
