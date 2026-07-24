---
name: cavuno-board-jobs
description: Browse, search, and render jobs with the @cavuno/board SDK — jobs.list, jobs.search, jobs.retrieve, jobs.similar. Covers the slim card vs full job shapes, catalog pagination (count/limit/offset + opaque cursor), filters, and the candidate-paywall gatedCount.
---

# Jobs: browse, search, detail

The highest-traffic surface. Listing and search return slim `PublicJobCard`s; the detail endpoint returns the full `PublicJob`.

## When to use

- Listing/search/keyword/location pages.
- The job-detail page and its "similar jobs" rail.

## When not to use

- Company-scoped listings — use `companies.listJobs` (same card shape).
- The ungated embeddable widget — use `embed.jobs`.

## List and render cards

`jobs.list` returns a `JobCardListEnvelope`: catalog pagination fields plus `data: PublicJobCard[]` and optional `relatedSearches`.

```ts snippet
const page = await board.jobs.list({ limit: 20, seniority: ['senior', 'lead'] });
page.count;        // total matches ("X jobs")
page.hasMore;      // more pages exist
page.nextCursor;   // opaque forward token, or null
for (const card of page.data) {
  card.title;
  card.company?.name;
  card.links.public; // canonical /companies/:companySlug/jobs/:jobSlug
}
```

### Filters and pagination

`JobsListQuery` supports `limit` (1–100), `offset` (takes precedence over `cursor`), `cursor`, and filters: `companyId`, `companySlug`, `remoteOption`, `employmentType`, `seniority` (single or repeated → OR-matched), `location` + `radius` (km), `category`, `skill`. Paginate by passing back `nextCursor`, or use numbered pages with `offset`:

```ts snippet
const p1 = await board.jobs.list({ limit: 20 });
const p2 = p1.nextCursor
  ? await board.jobs.list({ limit: 20, cursor: p1.nextCursor })
  : null;
// or numbered pages:
const page3 = await board.jobs.list({ limit: 20, offset: 40 });
```

### Company filter via public slug

`companySlug` is the public URL identity (what listing URLs carry). Prefer it
over `companyId` in frontends — the API resolves slugs server-side. Unknown
slugs are **ignored** (they contribute no matches, not an error); an entirely
unknown set yields an empty result list with `count: 0`. Combined with
`companyId` as a union when both are set. Cap is 10 values.

```ts snippet
const page = await board.jobs.list({
  limit: 20,
  companySlug: ['acme', 'globex'],
});
```

## Search

`jobs.search` posts a `JobsSearchBody` (free-text `query` + structured `filters`) and returns a `JobCardSearchEnvelope`. The same `companySlug` rule applies under `filters`:

```ts snippet
const results = await board.jobs.search({
  query: 'chef',
  filters: {
    seniority: ['senior'],
    remoteOption: ['remote'],
    companySlug: ['acme'],
    publishedAt: { gte: '2026-01-01T00:00:00Z' },
  },
  limit: 20,
});
```

## Detail and similar

```ts snippet
const job = await board.jobs.retrieve('senior-chef'); // full PublicJob
job.description;       // HTML
job.officeLocations;
job.company?.slug;
const rail = await board.jobs.similar('senior-chef', { limit: 5 });
```

## The candidate paywall: gatedCount

On gated boards, some results are hidden from anonymous/unentitled viewers. `gatedCount` is how many were withheld for the current viewer (absent/0 when entitled). Surface it as an upsell rather than pretending the list is complete:

```ts snippet
const page = await board.jobs.list({ limit: 20 });
if (page.gatedCount && page.gatedCount > 0) {
  // e.g. "Sign in to see N more roles"
}
```

A board-user bearer token on the same call returns the entitled (ungated) view — the endpoint is optional-auth, one URL for both anonymous and personalized reads.

## Full-catalog walks: paginate()

For sitemaps, feeds, or exports, never hand-roll the cursor loop — `paginate()` iterates items (or raw pages via `.pages()`) until `hasMore` is false, and drops `offset` after the first page (offset would win over the cursor and re-serve the same page forever):

```ts snippet
import { paginate } from '@cavuno/board';

for await (const card of paginate(board.jobs.list, { limit: 100 })) {
  urls.push(card.links.public);
}
const first500 = await paginate(board.jobs.list).toArray({ limit: 500 });
```

Iteration order is stable only under an explicit sort/search — a churning board reorders default browse results between pages.

## Checklist

- [ ] Listing/search use `PublicJobCard`; detail uses `PublicJob`.
- [ ] Job links use `links.public` (canonical `/companies/:companySlug/jobs/:jobSlug`).
- [ ] Pagination via `nextCursor` or `offset`, not client-side slicing.
- [ ] `gatedCount` surfaced as an upsell, not hidden.
