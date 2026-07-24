// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts.
import type { Schemas } from './_spec';

/**
 * The public SEO-infra payload (`board.seo()`) — the values a headless
 * frontend rebuilds `robots.txt` / `ads.txt` / `indexnow-key.txt` (+ the
 * Google site-verification `<meta>` + favicons/web-manifest) from,
 * byte-identically to the hosted board.
 */
export type BoardSeo = Schemas['BoardSeo'];
