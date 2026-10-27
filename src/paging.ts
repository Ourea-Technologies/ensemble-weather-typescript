// SPDX-License-Identifier: BSD-2-Clause
/**
 * Cursor paging (BEHAVIOR.md section 12).
 *
 * @module
 */

import type { Result } from './response.js';

/**
 * A list request. `await` it for one page, or iterate it with `for await` to
 * walk every item, following `nextCursor` lazily until it is null.
 *
 * @example
 * ```ts
 * const page = await ourea.listCatalogLocations({ limit: 50 });
 * for await (const location of ourea.listCatalogLocations({ admin1: 'US-OR' })) {
 *   console.log(location.slug);
 * }
 * ```
 */
export class PageRequest<TPage, TItem> implements PromiseLike<Result<TPage>>, AsyncIterable<TItem> {
  readonly #fetchPage: (cursor: string | undefined) => Promise<Result<TPage>>;
  readonly #items: (page: TPage) => readonly TItem[];
  readonly #nextCursor: (page: TPage) => string | null | undefined;
  readonly #cursor: string | undefined;
  #first: Promise<Result<TPage>> | undefined;

  /** @internal */
  constructor(
    fetchPage: (cursor: string | undefined) => Promise<Result<TPage>>,
    items: (page: TPage) => readonly TItem[],
    nextCursor: (page: TPage) => string | null | undefined,
    cursor: string | undefined,
  ) {
    this.#fetchPage = fetchPage;
    this.#items = items;
    this.#nextCursor = nextCursor;
    this.#cursor = cursor;
  }

  #firstPage(): Promise<Result<TPage>> {
    this.#first ??= this.#fetchPage(this.#cursor);
    return this.#first;
  }

  then<A = Result<TPage>, B = never>(
    onFulfilled?: ((page: Result<TPage>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.#firstPage().then(onFulfilled, onRejected);
  }

  /** Every page in turn, starting with this one. */
  async *pages(): AsyncGenerator<Result<TPage>, void, undefined> {
    let page = await this.#firstPage();
    for (;;) {
      yield page;
      const next = this.#nextCursor(page);
      if (next === null || next === undefined || next === '') return;
      page = await this.#fetchPage(next);
    }
  }

  /** Every item of every page, fetching pages only as they are needed. */
  async *[Symbol.asyncIterator](): AsyncGenerator<TItem, void, undefined> {
    for await (const page of this.pages()) yield* this.#items(page);
  }
}
