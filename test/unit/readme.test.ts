// SPDX-License-Identifier: BSD-2-Clause
// The README quickstart is examples/quickstart.ts, byte for byte, so it cannot rot.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SPEC } from '../helpers.js';

it('the README quickstart is examples/quickstart.ts', () => {
  const root = join(SPEC, '..');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const example = readFileSync(join(root, 'examples', 'quickstart.ts'), 'utf8');
  const block = /```ts\n(\/\/ Quickstart[\s\S]*?)```/.exec(readme)?.[1];
  expect(block).toBe(example);
});
