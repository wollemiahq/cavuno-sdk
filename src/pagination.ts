import type { FetchOptions } from './client';

/** The minimal page shape every v1 list/search envelope satisfies. */
interface PageShape {
  hasMore: boolean;
  nextCursor: string | null;
  data: unknown[];
}

type ItemOf<P extends PageShape> = P['data'][number];

export interface Paginator<P extends PageShape> extends AsyncIterable<
  ItemOf<P>
> {
  /** Iterate raw page envelopes instead of items. */
  pages(): AsyncGenerator<P, void, undefined>;
  /**
   * Collect items into an array, fetching pages only until `limit` items are
   * gathered. The cap is required — an unbounded collect over a large board
   * (tens of thousands of jobs) is an out-of-memory foot-gun.
   *
   * The cap bounds ITEMS collected, not the per-request page size — that is
   * the `limit` in the list QUERY. Collecting 500 items at the API's default
   * page size means many round trips; pass a page size too:
   * `paginate(board.jobs.list, { limit: 100 }).toArray({ limit: 500 })`.
   */
  toArray(opts: { limit: number }): Promise<ItemOf<P>[]>;
}

/**
 * Walk a paginated list method to exhaustion — `for await` over items or
 * pages, echoing the opaque `nextCursor` forward per `01-conventions.md` §7
 * until `hasMore` is `false`.
 *
 * Works with any SDK list/search method (or a closure over one, for methods
 * that take a leading id/slug). Cursor iteration order is stable only under
 * an explicit sort/query — see the jobs skill.
 *
 * `offset` is honored for the FIRST page only and dropped afterwards: on
 * job catalog reads let `offset` take precedence over `cursor`, so carrying it
 * forward would re-serve the same page forever.
 *
 * @example
 * // every published job, one page of 100 at a time
 * for await (const card of paginate(board.jobs.list, { limit: 100 })) {
 *   urls.push(card.links.public);
 * }
 *
 * @example
 * // raw pages (e.g. sitemap bucketing); leading-arg methods via a closure
 * const pager = paginate((q, o) => board.companies.listJobs('acme', q, o));
 * for await (const page of pager.pages()) { … }
 *
 * @example
 * // toArray's limit caps ITEMS; the query limit sets the PAGE size —
 * // pass both, or 500 items arrive at the default page size (many trips).
 * const first500 = await paginate(board.companies.list, { limit: 100 })
 *   .toArray({ limit: 500 });
 */
export function paginate<
  Q extends Record<string, unknown>,
  P extends PageShape,
>(
  listFn: (query?: Q, options?: FetchOptions) => Promise<P>,
  query?: Q,
  options?: FetchOptions,
): Paginator<P> {
  async function* pages(): AsyncGenerator<P, void, undefined> {
    let current: Record<string, unknown> | undefined = query;
    for (;;) {
      // The future release query is the caller's query + the echoed cursor, minus
      // `offset` (which would win over the cursor). Cast: Q is the caller's
      // query type and always admits `cursor` on cursor-paginated methods.
      const page = await listFn(current as Q | undefined, options);
      yield page;
      if (!page.hasMore || page.nextCursor === null) return;
      const { offset: _offset, ...rest } = current ?? {};
      current = { ...rest, cursor: page.nextCursor };
    }
  }

  return {
    pages,
    async *[Symbol.asyncIterator]() {
      for await (const page of pages()) {
        yield* page.data as ItemOf<P>[];
      }
    },
    async toArray({ limit }: { limit: number }) {
      const items: ItemOf<P>[] = [];
      for await (const page of pages()) {
        items.push(...(page.data as ItemOf<P>[]));
        if (items.length >= limit) break;
      }
      return items.slice(0, limit);
    },
  };
}
