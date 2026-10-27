#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copies ensemble-weather-spec at the ref in spec/VERSION into spec/.
//
//   node scripts/sync-spec.mjs            write spec/ from the ref in spec/VERSION
//   node scripts/sync-spec.mjs <ref>      pin a new ref, then write spec/
//   node scripts/sync-spec.mjs --check    fail if spec/ differs from that ref (CI)
//
// The source repository is OUREA_SPEC_REPO (a URL or a local path), by
// default https://github.com/Ourea-Technologies/ensemble-weather-spec.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specDir = join(root, 'spec');
const versionFile = join(specDir, 'VERSION');
const repo =
  process.env.OUREA_SPEC_REPO ?? 'https://github.com/Ourea-Technologies/ensemble-weather-spec';

const args = process.argv.slice(2);
const check = args.includes('--check');
const newRef = args.find((a) => !a.startsWith('--'));
const ref = newRef ?? readFileSync(versionFile, 'utf8').trim();
if (!/^[0-9A-Za-z._/-]+$/.test(ref)) throw new Error(`bad ref '${ref}'`);

/** Every tracked file of the spec repository at `ref`, as path -> bytes. */
function filesAt(ref) {
  const tmp = mkdtempSync(join(tmpdir(), 'ourea-spec-'));
  try {
    const git = (...a) =>
      execFileSync('git', a, { cwd: tmp, stdio: ['ignore', 'pipe', 'inherit'] });
    execFileSync('git', ['clone', '--quiet', '--no-checkout', repo, tmp], { stdio: 'inherit' });
    git('-c', 'advice.detachedHead=false', 'checkout', '--quiet', ref);
    const names = git('ls-files', '-z').toString().split('\0').filter(Boolean);
    return new Map(names.map((n) => [n, readFileSync(join(tmp, n))]));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function localFiles(dir, base = dir, out = new Map()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) localFiles(full, base, out);
    else out.set(relative(base, full).split('\\').join('/'), readFileSync(full));
  }
  return out;
}

const upstream = filesAt(ref);
upstream.set('VERSION', Buffer.from(`${ref}\n`));

if (check) {
  const local = localFiles(specDir);
  const problems = [];
  for (const [name, bytes] of upstream) {
    const mine = local.get(name);
    if (mine === undefined) problems.push(`missing: spec/${name}`);
    else if (!mine.equals(bytes)) problems.push(`differs: spec/${name}`);
  }
  for (const name of local.keys()) if (!upstream.has(name)) problems.push(`extra: spec/${name}`);
  if (problems.length > 0) {
    console.error(`spec/ does not match ensemble-weather-spec@${ref}:\n  ${problems.join('\n  ')}`);
    console.error('Run `npm run sync-spec` to fix.');
    process.exit(1);
  }
  console.log(`spec/ matches ensemble-weather-spec@${ref} (${String(upstream.size)} files).`);
} else {
  rmSync(specDir, { recursive: true, force: true });
  for (const [name, bytes] of upstream) {
    mkdirSync(dirname(join(specDir, name)), { recursive: true });
    writeFileSync(join(specDir, name), bytes);
  }
  console.log(`spec/ written from ensemble-weather-spec@${ref} (${String(upstream.size)} files).`);
}
