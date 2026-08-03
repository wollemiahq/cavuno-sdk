---
name: cavuno-board-jobs
description: Job catalog reads with @cavuno/board. Use for job browse or search, job detail, similar jobs, candidate gating, or full-catalog iteration.
---

# Jobs

Use cards for collections and the full job for detail: `jobs.list`,
`jobs.search`, and `jobs.similar` return `PublicJobCard`; only
`jobs.retrieve` returns `PublicJob`.

Company-scoped collections use `companies.listJobs`. The ungated embeddable
widget uses `embed.jobs`.

## Browse and paginate

`jobs.list(query)` returns `JobCardListEnvelope`: `data`, `count`, `limit`,
`offset`, `hasMore`, `nextCursor`, optional `relatedSearches`, and optional
`gatedCount`.

`JobsListQuery` accepts `limit` (1–100), `cursor`, `offset`, `companyId`,
`companySlug`, `remoteOption`, `employmentType`, `seniority`, `location` with
`radius` in kilometres, `category`, and `skill`. Repeated `seniority` values
are OR-matched. `offset` takes precedence over `cursor`, so choose one paging
mode per request.

```ts snippet
const first = await board.jobs.list({
  limit: 20,
  seniority: ['senior', 'lead'],
});
const second = first.nextCursor
  ? await board.jobs.list({ limit: 20, cursor: first.nextCursor })
  : null;
const page3 = await board.jobs.list({ limit: 20, offset: 40 });

for (const card of first.data) {
  card.title;
  card.company?.name;
  card.links.public;
}
```

Render `links.public` as the canonical
`/companies/:companySlug/jobs/:jobSlug` URL.

### Filter companies by public slug

Frontend URLs carry `companySlug`; pass it directly to the API. Unknown slugs
contribute no matches, and a wholly unknown set returns `count: 0` with empty
`data`. When `companyId` and `companySlug` are both present, their matches form
a union. Each accepts at most 10 values.

```ts snippet
const page = await board.jobs.list({
  limit: 20,
  companySlug: ['acme', 'globex'],
});
```

## Search

`jobs.search` posts `JobsSearchBody`: free-text `query`, structured `filters`,
and pagination. It returns `JobCardSearchEnvelope`; `companySlug` has the same
semantics inside `filters`.

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

## Render detail and similar jobs

```ts snippet
const job = await board.jobs.retrieve('senior-chef');
job.description; // HTML
job.officeLocations;
job.company?.slug;

const rail = await board.jobs.similar('senior-chef', { limit: 5 });
```

## Surface candidate gating

On a gated board, `gatedCount` reports results withheld from the current
viewer. Render it as an upsell. The same optional-auth endpoint returns the
entitled view when called with that board user's bearer token.

```ts snippet
const page = await board.jobs.list({ limit: 20 });
if ((page.gatedCount ?? 0) > 0) {
  // Render “Sign in to see N more roles”.
}
```

## Walk the full catalog

Use `paginate()` for sitemaps, feeds, and exports. It advances the opaque
cursor until `hasMore` is false and removes `offset` after the first request;
retaining the offset would make it win over the cursor and repeat a page.

```ts snippet
import { paginate } from '@cavuno/board';

for await (const card of paginate(board.jobs.list, { limit: 100 })) {
  urls.push(card.links.public);
}
const first500 = await paginate(board.jobs.list).toArray({ limit: 500 });
```

Default browse order can move while a board changes. Supply an explicit sort
or search whenever iteration order must stay stable.

## Completion gate

Finish only after every applicable check passes:

- Collections render `PublicJobCard`; detail renders `PublicJob`.
- Every job link comes from `links.public`.
- Pagination returns the final page once and ends with `nextCursor: null`.
- A gated anonymous response renders its `gatedCount` upsell, while an
  entitled request renders the ungated view.
- Full-catalog code uses `paginate()` and any order-sensitive walk has an
  explicit sort or search.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
