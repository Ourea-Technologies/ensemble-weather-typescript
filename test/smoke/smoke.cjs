// SPDX-License-Identifier: BSD-2-Clause
// Requires the BUILT CommonJS build.
const { Ourea, OureaError, VERSION } = require('../../dist/cjs/index.js');

const ourea = new Ourea({ apiKey: null });
if (!(ourea instanceof Ourea) || typeof OureaError !== 'function')
  throw new Error('bad CommonJS exports');
console.log(`ok ${VERSION} (CommonJS)`);
