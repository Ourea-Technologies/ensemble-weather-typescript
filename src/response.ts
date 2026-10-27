// SPDX-License-Identifier: BSD-2-Clause
/**
 * What the SDK reports about the HTTP exchange behind a result.
 *
 * @module
 */

/**
 * The rate-limit state from the last response's `RateLimit-*` headers.
 * Read it rather than hard-coding limits: they differ by plan and change.
 * Responses an edge cache may share (anonymous, keyless) carry none.
 */
export interface RateLimit {
  /** `RateLimit-Limit`: the burst size of the current window. */
  readonly limit: number | undefined;
  /** `RateLimit-Remaining`: requests left in the window. */
  readonly remaining: number | undefined;
  /** `RateLimit-Reset`: seconds until the window refills. */
  readonly reset: number | undefined;
  /** `RateLimit-Policy`, verbatim (for example `60;w=60`). */
  readonly policy: string | undefined;
}

/** A deprecation notice from the `Deprecation`, `Sunset` and `Link` headers. */
export interface DeprecationNotice {
  readonly deprecation: string | undefined;
  readonly sunset: string | undefined;
  /** The `Link rel="deprecation"` URL, where to read about it. */
  readonly link: string | undefined;
}

/** Details of the HTTP response behind a result. */
export interface ResponseMeta {
  /** HTTP status of the final response (200, or 304 when revalidated). */
  readonly status: number;
  /** The URL that was requested (the canonical form). */
  readonly url: string;
  /** The server's `X-Request-Id`. */
  readonly requestId: string | undefined;
  /** Rate-limit state, when the response carried it. */
  readonly rateLimit: RateLimit | undefined;
  /** True when the server answered `304` and the body came from the local cache. */
  readonly revalidated: boolean;
  readonly etag: string | undefined;
  readonly deprecation: DeprecationNotice | undefined;
}

/**
 * A result: the response model, plus `meta` (non-enumerable, so it never shows
 * up in `JSON.stringify` or spreads).
 */
export type Result<T> = T & { readonly meta: ResponseMeta };
