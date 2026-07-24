/**
 * `@cavuno/board/sitemap` — the hosted board's 8-bucket sitemap model for
 * custom frontends. Two tiers:
 *
 * - `xml.ts` — pure primitives: bucket names, 45k chunking, filename
 *   round-trip, and XML rendering byte-equal to the hosted serializers.
 * - `walker.ts` — the opinionated catalog walker: `listedBuckets` +
 *   `buildBucketUrls(board, origin, bucket)` taking the `BoardSdk`
 *   instance (pure logic, injected I/O), with the hosted rules built in —
 *   feature-flag bucket gating, the ≥5-job thin-content floor, and the
 *   pagination backstops.
 */
export * from './xml';
export * from './walker';
