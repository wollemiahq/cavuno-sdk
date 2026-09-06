---
name: cavuno-board-sitemap
description: Board sitemap generation with @cavuno/board/sitemap. Use for sitemap indexes, bucket routes, XML rendering, catalog walking, chunking, or robots.txt discovery.
---

# Sitemap generation

`@cavuno/board/sitemap` implements the hosted eight-bucket sitemap: an index at
`/sitemap.xml` points to ordinary `<urlset>` files for `marketing`,
`jobs-categories`, `jobs-skills`, `jobs-locations`, `jobs-details`,
`companies`, `salaries`, and optionally `blog`.

Structured data and head tags use `cavuno-board-seo`. The host app owns feeds.

## Use both tiers

The pure XML tier exports `SITEMAP_BUCKETS`, `SITEMAP_CHUNK_SIZE` (45,000),
`chunk`, `bucketFilename`, `parseBucketFilename`, `renderUrlset`, and
`renderSitemapIndex`. The catalog tier exports `listedBuckets(board)` and
`buildBucketUrls(board, origin, bucket)`; it walks the SDK and applies the
hosted indexing policy. `listedBucketEntries(board)` and
`buildBucketEntries(board, origin, bucket)` are the freshness-preserving
siblings: same walk and same policy, but each result keeps its
`lastModified`.

## Serve the index

List every non-empty chunk filename for every listed bucket. Keep one filename
for an empty bucket so its route returns a valid empty urlset. `listedBuckets`
removes blog when the feature is off.

```ts snippet
import {
  SITEMAP_CHUNK_SIZE,
  buildBucketUrls,
  bucketFilename,
  chunk,
  listedBuckets,
  renderSitemapIndex,
} from '@cavuno/board/sitemap';

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

## Serve a bucket file

Parse the filename, rebuild that bucket, select its zero-based chunk, and
render it. A filename outside the bucket grammar resolves to 404.

```ts snippet
import {
  SITEMAP_CHUNK_SIZE,
  buildBucketUrls,
  chunk,
  parseBucketFilename,
  renderUrlset,
} from '@cavuno/board/sitemap';

const parsed = parseBucketFilename(params.file);
if (!parsed) return notFound();

const urls = await buildBucketUrls(board, origin, parsed.bucket);
const page = chunk(urls, SITEMAP_CHUNK_SIZE)[parsed.chunkIndex] ?? [];
return xmlResponse(renderUrlset(page));
```

`renderUrlset` also accepts `{ url, lastModified?, images? }`; `Date` values
serialize to ISO 8601. `renderSitemapIndex` accepts strings or
`{ url, lastModified? }`. The hosted format omits `changefreq` and `priority`.

## Emit `<lastmod>`

Freshness is the strongest recrawl-priority signal on a large sitemap, so
prefer the entries walkers. `buildBucketEntries` returns
`{ url, lastModified? }[]` that feeds `renderUrlset` unchanged, and
`listedBucketEntries` returns `{ bucket, lastModified? }[]` for the index.
The board publishes a stamp per URL and per bucket wherever it tracks one;
entries without one simply omit `<lastmod>`.

```ts snippet
import {
  SITEMAP_CHUNK_SIZE,
  buildBucketEntries,
  bucketFilename,
  chunk,
  listedBucketEntries,
  renderSitemapIndex,
  renderUrlset,
  type SitemapIndexEntry,
} from '@cavuno/board/sitemap';

// Index: one <sitemap> per chunk, each carrying its bucket's stamp. Buckets
// over SITEMAP_CHUNK_SIZE produce -2, -3, … files; list every one.
const sitemaps: SitemapIndexEntry[] = [];
for (const { bucket, lastModified } of await listedBucketEntries(board)) {
  const chunks = chunk(await buildBucketEntries(board, origin, bucket), SITEMAP_CHUNK_SIZE);
  for (let i = 0; i < Math.max(chunks.length, 1); i += 1) {
    sitemaps.push({
      url: `${origin}/sitemap/${bucketFilename(bucket, i)}`,
      ...(lastModified ? { lastModified } : {}),
    });
  }
}
const indexXml = renderSitemapIndex(sitemaps);

// Bucket file: every <url> keeps its own stamp.
const entries = await buildBucketEntries(board, origin, parsed.bucket);
const page = chunk(entries, SITEMAP_CHUNK_SIZE)[parsed.chunkIndex] ?? [];
const bucketXml = renderUrlset(page);
```

`buildBucketUrls` and `listedBuckets` still return plain strings and bucket
names; they are unchanged, and a sitemap built from them carries no
`<lastmod>`.

## Keep the walker policy intact

`buildBucketEntries` is the policy boundary (`buildBucketUrls` is a map over
it):

- Taxonomy and location pages enter the sitemap at five distinct jobs,
  `MIN_JOBS_PER_INDEXED_PAGE`.
- Marketing URLs follow context feature flags for impressum, talent directory,
  and employers. Blog is listed only when `features.blog` is enabled.
- Salary index reads use `context().language`, producing board-language
  canonical salary slugs. Job, company, market, and blog slugs arrive
  canonical on the wire.
- Collections with `count` enumerate offsets in parallel up to the API's
  10,000-offset window. Cursor walks stop after 200 pages. Both paths warn when
  their backstop truncates output.
- XML escaping and hosted byte layout come from `renderUrlset` and
  `renderSitemapIndex`.

Cursor and offset order may move while a large board changes. That is safe for
this deduplicated sitemap heuristic. Use an explicit sort or search with
`board.jobs.list` for a stable ordered export.

## Preserve the named v1 exclusions

The walker omits families that v1 can discover only through per-slug N+1
reads: cross-axis salary pages (title×location, skill×location,
company×category, and per-entity salary indexes) and job
place×category/place×skill combinations. Internal links keep them reachable
until a bulk-pairs endpoint lets the walker add them.

## Publish discovery

At the site root, point robots.txt at the index:

```txt
Sitemap: https://jobs.example.com/sitemap.xml
```

## Completion gate

Finish only after every applicable check passes:

- `/sitemap.xml` lists all enabled buckets, omits blog when disabled, and every
  listed file returns valid XML, including empty buckets.
- A taxonomy page with four distinct jobs is absent and one with five is
  present.
- `jobs-details-2.xml` round-trips through `parseBucketFilename`; an unknown
  filename returns 404.
- More than 45,000 URLs produce numbered `-2`, `-3`, and later files without
  dropping or duplicating a URL.
- robots.txt points to the absolute `/sitemap.xml` URL.
- No excluded N+1 URL family is enumerated outside the walker.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
