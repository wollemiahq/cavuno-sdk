---
name: cavuno-board-companies
description: Company catalog reads with @cavuno/board. Use for company indexes, market archives, profiles, company job rails, similar companies, or company salary pages.
---

# Companies

Use `PublicCompany` for list and search rows. Use `PublicCompanyDetail` from
`companies.retrieve` for a profile; it alone adds `markets`.

Board-wide jobs use `jobs.*`, board-wide salary hubs use `salaries.*`, and
employer self-service uses authenticated `board.me.companies.*`. The host app
owns admin writes, sitemaps, and OG-image routes.

An approved admin can delete a company they manage and can list, retitle, or
remove members. Any approved member can leave with `board.me.companies.leave`.
Demoting, removing, or leaving as the last admin is `last_admin`. Admins
invite by email; approved members can list pending invites; accept is
session-gated on `board.me.acceptInvite`.

An approved member can buy a public, priced membership plan for the company
with `board.me.companies.startMembershipCheckout(slug, body)`. It returns the
same embedded-checkout mount kit as talent access; poll
`retrieveMembershipCheckout(slug, sessionId)` after the return redirect. A
company that already holds a membership is `membership_seat_taken`.

```ts snippet
await board.me.companies.delete('acme');
const { data: members } = await board.me.companies.listMembers('acme');
await board.me.companies.updateMemberRole('acme', members[0].id, {
  role: 'admin',
});
await board.me.companies.removeMember('acme', members[0].id);
await board.me.companies.leave('acme');

const { data: invites } = await board.me.companies.listInvites('acme');
await board.me.companies.createInvite('acme', { email: 'ada@acme.test' });
await board.me.companies.revokeInvite('acme', invites[0].id);
const { companySlug } = await board.me.acceptInvite({ token });
```

## List and search

`companies.list` returns `CompanyListEnvelope`: `ListEnvelope<PublicCompany>`
plus optional market `relatedSearches`. Its query accepts `limit` (1–100),
`cursor`, `offset`, and `marketSlug`. `offset` takes precedence over `cursor`;
use it with `count` for numbered or parallel paging. An unknown `marketSlug`
returns 404.

```ts snippet
const page = await board.companies.list({
  limit: 20,
  marketSlug: 'cybersecurity',
});
for (const company of page.data) {
  company.name;
  company.publishedJobCount;
  company.links.public; // null when the company has no slug
}
```

`companies.search` posts a `CompaniesSearchBody`: `query` matched against the
company name (up to 200 characters), optional `marketSlug`, `cursor`, and
`limit` (1–100). It returns `SearchEnvelope<PublicCompany>`.

```ts snippet
const results = await board.companies.search({ query: 'acme', limit: 20 });
```

## Resolve markets

`companies.markets` is callable and carries `.resolve`. The call returns
`CompanyMarket` rows (`slug`, `name`, `companyCount`) ranked by company count;
it accepts `limit` (1–200, default 100) and optional `search`.

Resolve an inbound slug before loading an archive. `TaxonomyResolution`
returns `sourceSlug`, `canonicalSlug`, `displayName`, and `redirectTo`. Issue a
308 to `redirectTo` when present, then use the resolved slug as `marketSlug`.

```ts snippet
const { data: markets } = await board.companies.markets({ search: 'robotics' });
const market = await board.companies.markets.resolve('cybersecurity');
if (market.redirectTo) {
  // Return a 308 to the same archive at market.redirectTo.
}
```

## Render a profile

`PublicCompany` carries `id`, `name`, `slug`, `website`, `logoUrl`,
`description`, `jobCount`, `publishedJobCount`, and `links.public`.
`PublicCompanyDetail` adds `markets: CompanyMarketRef[]`, whose rows contain
`name` and source `slug`.

```ts snippet
const company = await board.companies.retrieve('acme');
company.markets;

const jobs = await board.companies.listJobs('acme', { limit: 10 });
const rail = await board.companies.similar('acme', { limit: 6 });
```

`listJobs` returns the same `JobCardListEnvelope` as `jobs.list` and accepts
only cursor plus limit. `similar` accepts `limit` 1–20 (default 6), excludes
the current company, and ranks by open roles. Fetch `retrieve` before reading
`markets`; list and search rows have no `markets` field.

## Render company salaries

`companies.salaries` is callable and carries `.summary` and `.category`.

For a profile / overview teaser, prefer `.summary` — it returns
`CompanySalarySummary` (overall numbers, top categories, `sampleCount`,
`currency`) without seniority, competitors, locations, or logos. Format
currency ranges and multi-locale UI strings in the app.

The full overview returns `CompanySalary`: nullable `overallSalary`,
`bySeniority` rows with board comparison `diffPercent`, `competitors`,
`topLocations`, `byCategory`, board-wide baselines, and `currency`.

```ts snippet
const teaser = await board.companies.salaries.summary('acme');
teaser.overallSalary;
teaser.topCategories;
teaser.sampleCount;

const overview = await board.companies.salaries('acme');
overview.bySeniority[0]?.diffPercent;

const category = await board.companies.salaries.category(
  'acme',
  'software-engineer',
  { locale: 'de' });
category.categorySourceSlug;
category.categoryCanonicalSlug;
```

Pass `{ locale }` for board-language category names on `.category`. Company
identity remains untranslated. The API returns both the immutable English
`categorySourceSlug` and the board-language `categoryCanonicalSlug`; the host
route issues a 308 when the inbound category slug differs from the canonical
one. Gate a Salaries tab with `company.salarySampleCount > 0` from
`companies.retrieve` rather than fetching salary documents just for presence.

## Completion gate

Finish only after every applicable check passes:

- A known company is a `public_company`; only its retrieve response has a
  `markets` array.
- A listed market slug works as `marketSlug`, while an invented one produces a
  handled 404.
- Cursor pagination reaches `nextCursor: null` without repeating a page.
- A non-canonical market or salary-category route returns a 308 to the slug
  supplied by the API.
- Salary figures and comparisons come directly from `CompanySalary` fields.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
