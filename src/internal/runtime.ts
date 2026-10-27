// SPDX-License-Identifier: BSD-2-Clause
// Runtime detection for the User-Agent, and environment variables, without
// depending on any one runtime's type definitions.

interface RuntimeGlobals {
  Bun?: { version?: string };
  Deno?: { version?: { deno?: string }; env?: { get(name: string): string | undefined } };
  process?: { versions?: { node?: string }; env?: Record<string, string | undefined> };
  navigator?: { userAgent?: string };
  window?: unknown;
  document?: unknown;
}

const g = globalThis as RuntimeGlobals;

/** `<runtime>/<version>` for the User-Agent comment. */
export function runtimeToken(): string {
  if (g.Bun?.version !== undefined) return `Bun/${g.Bun.version}`;
  if (g.Deno?.version?.deno !== undefined) return `Deno/${g.Deno.version.deno}`;
  if (g.process?.versions?.node !== undefined) return `Node.js/${g.process.versions.node}`;
  if (g.navigator?.userAgent === 'Cloudflare-Workers') return 'Cloudflare-Workers/unknown';
  return 'unknown/unknown';
}

/**
 * True in a web browser, where `User-Agent` is the browser's own and setting
 * it would only force a CORS preflight.
 */
export function isBrowser(): boolean {
  return g.window !== undefined && g.document !== undefined && g.Deno === undefined;
}

/** An environment variable, or `undefined` where there is no environment or no permission. */
export function readEnv(name: string): string | undefined {
  try {
    // eslint-disable-next-line security/detect-object-injection -- reading an environment variable by name
    const fromProcess = g.process?.env?.[name];
    if (fromProcess !== undefined) return fromProcess;
  } catch {
    // Deno without --allow-env throws here.
  }
  try {
    return g.Deno?.env?.get(name);
  } catch {
    return undefined;
  }
}
