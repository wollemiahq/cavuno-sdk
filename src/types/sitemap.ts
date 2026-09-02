// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response entities alias the generated components;
// query types stay hand-written (no serializer to drift from).
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/** One bucket in the board's sitemap: its name, size, and freshness stamp. */
export type BoardSitemapBucketSummary = Schemas['BoardSitemapBucketSummary'];

/**
 * The board's sitemap bucket index (`board.sitemap()`) — the buckets the board
 * publishes, in canonical order, empty ones omitted. Read each bucket's paths
 * with `board.sitemap.entries(bucket)`.
 */
export type BoardSitemapIndex = Schemas['BoardSitemap'];

/**
 * One sitemap URL as a BOARD-RELATIVE path (always leading `/`). Prefix it with
 * your own origin — the API never returns an origin, so a custom domain, a
 * preview deploy, and production all build correct URLs from the same page.
 */
export type SitemapEntry = Schemas['SitemapEntry'];

export type SitemapEntriesQuery = {
  /** Page size, 1–1000 (default 1000). */
  limit?: number;
  /** Opaque forward cursor from a previous response's `nextCursor`. */
  cursor?: string;
};

/** One page of a bucket's entries. Walk it with `paginate`. */
export type SitemapEntriesEnvelope = ListEnvelope<SitemapEntry>;
