import type { BoardClient, FetchOptions } from '../client';
import type {
  BoardSitemapIndex,
  SitemapEntriesEnvelope,
  SitemapEntriesQuery,
} from '../types/sitemap';

export function sitemapNamespace(client: BoardClient) {
  /**
   * The board's sitemap, exactly as the hosted board publishes it.
   *
   * `board.sitemap()` lists the buckets (name, entry count, last-modified);
   * `board.sitemap.entries(bucket)` returns one page of BOARD-RELATIVE paths
   * in that bucket. Prefix each `path` with your own origin.
   *
   * Mirroring these two calls reproduces the hosted sitemap by construction —
   * every page the board considers indexable, including the cross-axis salary
   * and jobs pages a per-family enumeration cannot reach. Prefer it over
   * re-deriving the rules from the catalog endpoints.
   *
   * @example
   * const { buckets } = await board.sitemap();
   * for (const { bucket } of buckets) {
   *   for await (const entry of paginate(
   *     (query) => board.sitemap.entries(bucket, query),
   *     { limit: 1000 },
   *   )) {
   *     urls.push(`https://jobs.acme.com${entry.path}`);
   *   }
   * }
   */
  return Object.assign(
    (options?: FetchOptions) =>
      client.fetch<BoardSitemapIndex>('/sitemap', options),
    {
      entries(
        bucket: string,
        query?: SitemapEntriesQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<SitemapEntriesEnvelope>(
          `/sitemap/${encodeURIComponent(bucket)}`,
          { ...options, query },
        );
      },
    },
  );
}
