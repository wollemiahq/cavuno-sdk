---
name: cavuno-board-companies
description: Build company surfaces with the @cavuno/board SDK — the companies index (companies.list / companies.search with the market filter), the company profile (companies.retrieve, listJobs, similar), the markets sub-surface (companies.markets + markets.resolve with its 308 redirectTo), and company salary pages (companies.salaries + salaries.category). Covers PublicCompany vs PublicCompanyDetail and envelope pagination.
---

# Companies: index, profile, markets, salaries

Lists and search return `PublicCompany`; only `retrieve` returns `PublicCompanyDetail` (which adds `markets`). Company salary pages are their own sub-surface under `companies.salaries`.

## When to use

- The companies index page and its market (sector) filter.
- The company profile page: detail, open-jobs list, similar-companies rail.
- Per-company salary pages (`/companies/:slug/salaries[/:category]`).

## When not to use

- Board-wide job browse/search — `jobs.*` (see cavuno-board-jobs).
- Board-wide salary hubs (titles/skills/locations) — `board.salaries.*`.
- Employer self-service (claiming/managing a company) — the authed `board.me.companies.*` surface.

Out of scope — do not invent exports: no company create/update/logo upload (that is the admin API, not this SDK), and no sitemap or OG-image generation — the host app owns those routes.

## List, search, market filter

`companies.list` returns a `CompanyListEnvelope`: `ListEnvelope<PublicCompany>` plus optional `relatedSearches` (market suggestions). `CompaniesListQuery` supports `limit` (1–100), `cursor`, `offset` (takes precedence over `cursor`; pair with the response `count` to page in parallel), and `marketSlug` — unknown market slugs 404.

```ts snippet
const page = await board.companies.list({ limit: 20, marketSlug: 'cybersecurity' });
page.hasMore;
page.nextCursor; // null when hasMore is false
for (const company of page.data) {
  company.name;
  company.publishedJobCount;
  company.links.public; // canonical URL, or null when the company lacks a slug
}
```

`companies.search` posts a `CompaniesSearchBody` (`query` free text matched against the company name, up to 200 chars; optional `marketSlug`, `cursor`, `limit` 1–100) and returns a `SearchEnvelope<PublicCompany>`:

```ts snippet
const results = await board.companies.search({ query: 'acme', limit: 20 });
```

## Markets (sectors)

`companies.markets` is callable AND carries `.resolve`. The call lists the board's markets ranked by company count (`CompanyMarket`: `slug`, `name`, `companyCount`; `limit` 1–200, default 100 — a top-N preview; optional `search`). `.resolve(slug)` returns a `TaxonomyResolution` — `sourceSlug`, `canonicalSlug`, `displayName`, and `redirectTo` (the canonical slug to 308 to when the inbound slug differs; `null` otherwise).

```ts snippet
const { data: markets } = await board.companies.markets({ search: 'robotics' });
const market = await board.companies.markets.resolve('cybersecurity');
if (market.redirectTo) {
  // 308 the market-scoped browse to the canonical slug
}
```

Resolve first, then pass the resolved slug as `marketSlug` — don't guess slugs (unknown ones 404).

## Profile: retrieve, jobs, similar

`PublicCompany` (lists/search) carries: `id`, `name`, `slug`, `website`, `logoUrl`, `description`, `jobCount`, `publishedJobCount`, `links.public`. `PublicCompanyDetail` (retrieve only) adds `markets: CompanyMarketRef[]` (`name` + source `slug`; empty when none).

```ts snippet
const company = await board.companies.retrieve('acme'); // PublicCompanyDetail
company.markets;                                        // detail-only

const jobs = await board.companies.listJobs('acme', { limit: 10 });
// JobCardListEnvelope — same PublicJobCard shape as jobs.list; cursor + limit only

const rail = await board.companies.similar('acme', { limit: 6 }); // 1–20, default 6
```

`similar` uses the hosted ranking (most open roles first) and excludes the company itself.

Anti-pattern: don't render `markets` from a list row — it only exists on the detail. Fetch `retrieve` for the profile page.

## Company salaries

`companies.salaries` is callable AND carries `.category`. The call is the company salary overview (`CompanySalary`): `overallSalary` (nullable), `bySeniority` rows vs the board baseline (`diffPercent`), `competitors`, `topLocations`, `byCategory`, board-wide baselines, and `currency`. `.category(companySlug, categorySlug, { locale })` is one job category at the company (`CompanyCategorySalary`).

```ts snippet
const overview = await board.companies.salaries('acme');
overview.bySeniority[0]?.diffPercent; // vs the board baseline, or null

const cat = await board.companies.salaries.category('acme', 'software-engineer', {
  locale: 'de',
});
cat.categorySourceSlug;    // immutable English slug
cat.categoryCanonicalSlug; // board-language slug — 308 to it when the inbound differs
```

Pass `{ locale }` for board-language category names; the company slug/name are never localized. The response returns BOTH `categorySourceSlug` and `categoryCanonicalSlug` — the consumer issues the 308 itself.

## Verify

- `companies.retrieve('<known-slug>')` returns `object: 'public_company'` with a `markets` array; the same company in `companies.list` has no `markets` key.
- A slug from `companies.markets()` works as `marketSlug`; a made-up slug returns 404 (`isNotFound`).
- Paginating with `nextCursor` terminates: `nextCursor` is `null` on the last page.
- `companies.salaries.category(...)` with a non-canonical category slug returns a differing `categoryCanonicalSlug`, and your route 308s to it.
