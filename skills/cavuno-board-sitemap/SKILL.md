---
name: cavuno-board-sitemap
description: Build the board's sitemap with @cavuno/board/sitemap — the hosted 8-bucket model (marketing, jobs taxonomies, job details, companies, salaries, blog), 45k chunking, XML rendering, and the buildBucketUrls walker that enumerates a board's content through the BoardSdk with the hosted SEO rules built in (feature gating, ≥5-job thin-content floor, pagination backstops). Use when adding /sitemap.xml and /sitemap/:file routes to a custom board frontend.
---

# Sitemap: the 8-bucket model

`@cavuno/board/sitemap` ships the hosted board's sitemap architecture: a
sitemap INDEX at `/sitemap.xml` pointing at one file per content bucket,
each an ordinary `<urlset>`. The XML byte layout and the bucket rules are
tested against the hosted implementation, so a custom frontend's
sitemap corpus lines up bucket-for-bucket with what cavuno.com would emit.

Two tiers, use both:

- **XML primitives** (pure, no I/O): `SITEMAP_BUCKETS`,
  `SITEMAP_CHUNK_SIZE` (45,000), `chunk`, `bucketFilename` /
  `parseBucketFilename`, `renderUrlset`, `renderSitemapIndex`.
- **The walker** (opinionated, injected I/O): `listedBuckets(board)` and
  `buildBucketUrls(board, origin, bucket)` take your `BoardSdk` instance
  and return plain URL strings with the hosted rules applied — you never
  re-derive the SEO policy.

## When to use

- Adding `/sitemap.xml` + `/sitemap/:file` routes to a board frontend.
- Deciding which listing pages deserve indexing (the walker already does).

## When not to use

- Structured data / meta tags — `cavuno-board-seo`.
- Feeds (RSS/Atom) — app-owned.

## The two routes

The index lists one entry per bucket; each bucket route parses its filename
back to a bucket + chunk and renders a urlset. Empty buckets render a valid
empty urlset — only `blog` is dropped from the index when the feature is
off (`listedBuckets` handles that).

```ts snippet
import {
  SITEMAP_CHUNK_SIZE,
  buildBucketUrls,
  bucketFilename,
  chunk,
  listedBuckets,
  parseBucketFilename,
  renderSitemapIndex,
  renderUrlset,
} from '@cavuno/board/sitemap';

// GET /sitemap.xml — one <sitemap> per listed bucket (plus -2, -3… chunks).
const origin = 'https://jobs.example.com';
const buckets = await listedBuckets(board);
const locs: string[] = [];
for (const bucket of buckets) {
  const urls = await buildBucketUrls(board, origin, bucket);
  const chunks = chunk(urls, SITEMAP_CHUNK_SIZE);
  for (let i = 0; i < Math.max(chunks.length, 1); i += 1) {
    locs.push(`${origin}/sitemap/${bucketFilename(bucket, i)}`);
  }
}
return xmlResponse(renderSitemapIndex(locs));
```

```ts snippet
// GET /sitemap/:file — parse, enumerate, slice, render. Unknown file → 404.
const parsed = parseBucketFilename(params.file);
if (!parsed) return notFound();
const urls = await buildBucketUrls(board, origin, parsed.bucket);
const page = chunk(urls, SITEMAP_CHUNK_SIZE)[parsed.chunkIndex] ?? [];
return xmlResponse(renderUrlset(page));
```

`renderUrlset` also accepts `{ url, lastModified?, images? }` entries when
you have per-URL dates (a `Date` serializes to ISO 8601). `changefreq` and
`priority` are deliberately unsupported — the hosted board never emits them.

## robots.txt

Point crawlers at the index — one line, at the site root:

```txt
Sitemap: https://jobs.example.com/sitemap.xml
```

## The rules the walker enforces (don't re-implement)

- **Thin-content floor**: a category/skill/location listing page is emitted
  only with ≥5 distinct jobs (`MIN_JOBS_PER_INDEXED_PAGE`) — below that,
  the page is thin content that wastes crawl budget.
- **Feature gating**: `/impressum`, `/talent`, `/employers` appear in the
  marketing bucket only when `context().features` enables them; the blog
  bucket exists only when `features.blog` is on.
- **Board language**: salary-index reads pass `context().language`, so a
  non-English board emits board-language canonical salary slugs (jobs,
  companies, and blog slugs arrive canonical on the wire already). No
  locale parameter to thread.
- **Pagination backstops**: offset enumeration runs in parallel when the
  envelope carries `count` (capped at the API's 10,000-offset window);
  cursor walks cap at 200 pages. Both warn on truncation instead of
  hanging a build.

## Stable order caveat (cursor walks)

Cursor and offset enumeration order can shift between requests on a large,
churning board — two chunk requests may see slightly different orderings.
That is harmless for a sitemap (URLs dedupe and the ≥5 counts are a
heuristic), but do NOT reuse the walker as a general "export all jobs in
order" tool; for stable ordering, pass an explicit sort/query to
`board.jobs.list` yourself.

## Named exclusions (v1 API gap — not bugs)

Two URL families the HOSTED sitemap emits are deliberately absent, because
v1 exposes them only per-slug and a bulk-pairs endpoint doesn't exist yet
(per-slug N+1 is ~1k+ calls per build):

- Cross-axis salary pages (title×location, skill×location,
  company×category, and the per-entity `/locations` · `/titles` ·
  `/skills` salary index pages).
- Jobs place×category / place×skill combination listings.

Both stay reachable through internal links. When the bulk endpoint lands,
the walker picks them up additively — don't hand-enumerate them.

## Anti-patterns

```ts snippet
// NEVER emit every taxonomy page unconditionally — the ≥5-job floor exists
// to keep thin pages out of the index:
for (const c of allCategories) urls.push(`${origin}/jobs/${c.slug}`); // wrong
// NEVER hand-build the XML with a template string per route — use
// renderUrlset/renderSitemapIndex (escaping + byte-parity with hosted).
// NEVER fetch every salary detail page to discover cross-axis pairs (N+1).
```

## Verify

- [ ] `/sitemap.xml` lists one file per bucket (no `blog` entry when the
      feature is off) and every listed file returns valid XML.
- [ ] A category with 4 jobs is absent from `jobs-categories.xml`; one with
      5 is present.
- [ ] `jobs-details-2.xml` style chunk names round-trip through
      `parseBucketFilename` and unknown filenames 404.
- [ ] robots.txt points at `/sitemap.xml`.
