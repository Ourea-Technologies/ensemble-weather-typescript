// SPDX-License-Identifier: BSD-2-Clause
/**
 * The local ETag cache (BEHAVIOR.md section 10). On by default: a repeated
 * call sends `If-None-Match`, and a `304` returns the stored body without
 * downloading it again. Replace the store to share it across processes.
 *
 * @module
 */

/** One stored response. */
export interface CacheEntry {
  /** The `ETag` exactly as received (a `W/` prefix included). */
  readonly etag: string | undefined;
  /** The response body as text. */
  readonly body: string;
  /** When it was stored, in milliseconds since the epoch. */
  readonly storedAt: number;
  /** The response's `max-age` in seconds (the API sends 0: always revalidate). */
  readonly maxAge: number;
}

/**
 * Where the client keeps cached responses. Keys are opaque: the full URL plus
 * a hash of the API key that sent it (never the key itself), so keyless and
 * keyed entries never mix. Methods may return promises.
 */
export interface CacheStore {
  get(key: string): CacheEntry | undefined | Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}

/** Bounds for {@link MemoryCache}. */
export interface MemoryCacheOptions {
  /** At most this many entries. Default 256. */
  readonly maxEntries?: number;
  /** At most this many bytes of bodies (UTF-8). Default 32 MiB. */
  readonly maxBytes?: number;
}

/** An in-memory LRU {@link CacheStore}, bounded by entries and bytes. The default store. */
export class MemoryCache implements CacheStore {
  readonly #maxEntries: number;
  readonly #maxBytes: number;
  readonly #entries = new Map<string, { entry: CacheEntry; bytes: number }>();
  #bytes = 0;

  constructor(options: MemoryCacheOptions = {}) {
    this.#maxEntries = options.maxEntries ?? 256;
    this.#maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  }

  /** The number of stored entries. */
  get size(): number {
    return this.#entries.size;
  }

  get(key: string): CacheEntry | undefined {
    const hit = this.#entries.get(key);
    if (hit === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, hit);
    return hit.entry;
  }

  set(key: string, entry: CacheEntry): void {
    this.delete(key);
    const bytes = new TextEncoder().encode(entry.body).length;
    if (bytes > this.#maxBytes || this.#maxEntries < 1) return;
    this.#entries.set(key, { entry, bytes });
    this.#bytes += bytes;
    for (const [oldest, { bytes: b }] of this.#entries) {
      if (this.#entries.size <= this.#maxEntries && this.#bytes <= this.#maxBytes) break;
      this.#entries.delete(oldest);
      this.#bytes -= b;
    }
  }

  delete(key: string): void {
    const hit = this.#entries.get(key);
    if (hit === undefined) return;
    this.#entries.delete(key);
    this.#bytes -= hit.bytes;
  }

  /** Drops every entry. */
  clear(): void {
    this.#entries.clear();
    this.#bytes = 0;
  }
}
