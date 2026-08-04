// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts.
import type { Schemas } from './_spec';

/**
 * The public SEO-infra payload (`board.seo()`) — platform infrastructure a
 * headless frontend rebuilds `robots.txt` / `ads.txt` / `indexnow-key.txt`
 * (+ the Google site-verification `<meta>`) from, byte-identically to the
 * hosted board. Icons and `themeColor` left in 4.0.0; applications
 * own brand assets and presentation tokens.
 */
export type BoardSeo = Schemas['BoardSeo'];
