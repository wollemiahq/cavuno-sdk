---
name: cavuno-board-salaries
description: Salary read models with @cavuno/board. Use for title, skill, or location salary indexes and detail, cross-axis pages, or the salary companies hub.
---

# Salaries

The salary namespaces return pre-aggregated read models. Render their figures
directly in the response `currency`; server-side weighted averages, medians,
percentile bands, and seniority splits are the source of truth.

Single-company salary pages use `companies.salaries` and
`companies.salaries.category`. A job's own range comes from its
`salaryMin`/`salaryMax` fields.

## Build axis indexes

Titles, skills, and locations each expose `.list()`. Index items contain
`avgSalaryMin`, `avgSalaryMax`, and sample-size `jobCount`; title and skill
items also contain `p25SalaryMin`, `p75SalaryMax`, and `currency`.

```ts snippet
const titles = await board.salaries.titles.list();
for (const title of titles.data) {
  title.slug;
  title.name;
  title.avgSalaryMin;
  title.avgSalaryMax;
  title.jobCount;
}
const skills = await board.salaries.skills.list();
const companies = await board.salaries.companies.list();
```

`salaries.companies.list()` ranks companies by sample size.
`salaries.locations.list()` returns a flattened place tree: rebuild country,
region, and city nesting from each `SalaryLocation.parentSlug`; top-level rows
have `parentSlug: null`.

## Retrieve detail and canonicalize slugs

Every axis `retrieve(slug)` accepts an inbound English or board-language slug.
The result includes immutable English `sourceSlug` and board-language
`canonicalSlug`. Pass `{ locale }` for board-language names and canonical
slugs, then issue a 308 when the inbound slug differs from `canonicalSlug`.
The API itself returns data rather than a redirect.

```ts snippet
const title = await board.salaries.titles.retrieve('software-engineer', {
  locale: 'de',
});
title.canonicalSlug;
title.overallSalary;
title.bySeniority;
title.topCompanies;
title.currency;

const skill = await board.salaries.skills.retrieve('python');
const place = await board.salaries.locations.retrieve('berlin');
```

`overallSalary` is nullable. Render an empty state when it is `null`.
Title detail contains `{ avgMin, avgMax, p25Min, p75Max, jobCount }` there and
exposes medians as top-level `boardMedianMin` and `boardMedianMax`. Skill and
location details instead include `medianMin` and `medianMax` inside
`overallSalary`. Title and skill `bySeniority` rows include board-comparison
fields such as `boardAvgMin` and `diffPercent`.

## Build cross-axis pages

Titles and skills expose `.locations(slug)` and
`.location(slug, locationSlug)`. Locations expose `.titles(slug)` and
`.skills(slug)`.

```ts snippet
const index = await board.salaries.titles.locations('software-engineer');
index.locations;

const berlin = await board.salaries.titles.location(
  'software-engineer',
  'berlin');
berlin.categoryCanonicalSlug;
berlin.locationCanonicalSlug;
berlin.overallSalary;

const titlesInBerlin = await board.salaries.locations.titles('berlin');
const skillsInBerlin = await board.salaries.locations.skills('berlin');
```

A cross-axis detail carries four slug fields: source and canonical slugs for
both category and location. Canonicalize both URL segments. Its
`overallSalary.p25Min` and `p75Max` may be null.

## Preserve aggregate semantics

Display response fields as-is. Client arithmetic such as averaging min/max,
deriving medians from percentiles, summing rails, or converting currencies
changes the weighted meaning and diverges from the hosted board. Use
`jobCount`, rather than `data.length`, for sample-size copy.

## Completion gate

Finish only after every applicable check passes:

- Stale axis and cross-axis slugs produce 308s to every returned canonical
  segment.
- A non-English board passes `{ locale }` and renders board-language names.
- `overallSalary: null` renders an empty state rather than `0` or `NaN`.
- Every salary, comparison, and sample size maps directly to a response field
  and uses the response currency.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
