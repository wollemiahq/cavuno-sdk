---
name: cavuno-board-salaries
description: Build salary pages with the @cavuno/board SDK — salaries.titles/skills/locations (list + retrieve + cross-axis .locations/.location/.titles/.skills), salaries.companies.list. Covers the sourceSlug/canonicalSlug 308 contract, the { locale } overlay, aggregate field shapes (avg/median/percentile bands + jobCount), and why salary math must never be recomputed client-side.
---

# Salary pages

Pre-aggregated salary read-models, one nested resource per axis (titles, skills, locations) plus a companies hub. Every number is server-computed; the SDK returns render-ready aggregates.

## When to use

- `/salaries` index pages (by title, skill, or location) and their detail pages.
- Cross-axis pages: "Software Engineer salary in Berlin", "Python salary by location".
- The `/salaries/companies` hub.

## When not to use

- A single company's salary pages — use `companies.salaries(slug)` / `companies.salaries.category(slug, categorySlug)` (see the companies namespace).
- Per-job salary display — the job itself carries `salaryMin`/`salaryMax` (see `cavuno-board-jobs`).

## Out of scope — do not invent exports

Only the methods and fields shown here exist. If a field is not in these snippets or the exported types, do not reference it.

## Index pages

Each axis has `list` returning a `ListEnvelope` of index items. Index items carry `avgSalaryMin`/`avgSalaryMax` and `jobCount` (sample size); title/skill items add `p25SalaryMin`/`p75SalaryMax` and `currency`.

```ts snippet
const titles = await board.salaries.titles.list();
for (const t of titles.data) {
  t.slug; t.name;
  t.avgSalaryMin; t.avgSalaryMax; // render as-is, in t.currency
  t.jobCount;                     // "based on N jobs"
}
const skills = await board.salaries.skills.list();
const companies = await board.salaries.companies.list(); // ranked by sample size
```

`salaries.locations.list()` returns a flattened place tree — each `SalaryLocation` has `parentSlug` (`null` at the top level); rebuild the country → region → city browse from those edges.

## Detail pages and the slug contract

`retrieve(slug)` accepts the inbound slug (board-language or English) and returns both `sourceSlug` (immutable English stats key) and `canonicalSlug` (board-language URL). **The API never redirects — your app 308s to `canonicalSlug` when the inbound slug differs.** Pass `{ locale }` for board-language names + canonical slugs (`en` is the identity fast-path).

```ts snippet
const title = await board.salaries.titles.retrieve('software-engineer', { locale: 'de' });
title.canonicalSlug;   // 308 target if it differs from the requested slug
title.overallSalary;   // { avgMin, avgMax, p25Min, p75Max, jobCount } | null
title.bySeniority;     // rows with avgSalaryMin/avgSalaryMax/jobCount + board comparison
title.topCompanies;    // rails: { avgSalaryMin, avgSalaryMax, jobCount, ... }
title.currency;        // the single currency all numbers are quoted in

const skill = await board.salaries.skills.retrieve('python');
const place = await board.salaries.locations.retrieve('berlin');
```

`overallSalary` is `null` when the axis has no sample — render an empty state, don't fabricate a band. Skill and location details also carry `medianMin`/`medianMax` inside `overallSalary`; the title detail exposes medians as top-level `boardMedianMin`/`boardMedianMax` instead. `bySeniority` rows on title/skill details include board-wide comparison fields (`boardAvgMin`, `diffPercent`, …) for "X% above board average" copy.

## Cross-axis pages

Titles and skills each expose `.locations(slug)` (index of places with data) and `.location(slug, locationSlug)` (one place); locations expose the suffix reads `.titles(slug)` and `.skills(slug)`.

```ts snippet
const idx = await board.salaries.titles.locations('software-engineer');
idx.locations; // SalaryLocation[] — flattened parentSlug tree

const berlin = await board.salaries.titles.location('software-engineer', 'berlin');
berlin.categoryCanonicalSlug; // 4 slugs: category/location × source/canonical
berlin.locationCanonicalSlug;
berlin.overallSalary;         // p25Min/p75Max nullable here

const inBerlin = await board.salaries.locations.titles('berlin');
const skillsInBerlin = await board.salaries.locations.skills('berlin');
```

## Never recompute salary math

Render the returned aggregates **as-is**. Do not average mins and maxes, derive medians from percentiles, sum across rails, or convert currency client-side — every response quotes one board `currency` and the weighted math is done server-side against the full sample. Client-side arithmetic will disagree with the hosted board and other consumers.

## Verify

- [ ] Requesting a title/skill/location by a stale slug renders a 308 to `canonicalSlug`.
- [ ] A non-`en` board passes `{ locale }` and shows board-language names.
- [ ] An axis with `overallSalary: null` shows an empty state, not `NaN`/`0`.
- [ ] All displayed figures match the raw response fields (no client math), formatted in the response `currency`.
- [ ] Sample sizes come from `jobCount`, not `data.length`.
