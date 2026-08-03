---
name: cavuno-board-filters
description: Listing-filter contracts with @cavuno/board. Use for job filter controls, sort controls, listing URL validation, or taxonomy-backed filter options.
---

# Listing filters

`@cavuno/board/filters` is the shared vocabulary and parser for every job
listing route, including category, skill, and location pages. Display labels
live in `@cavuno/board/format`; search POST bodies use `jobs.search`; typeahead
UI behavior lives in `cavuno-board-search-suggestions`.

## Parse public URL input

Run every listing URL through `parseListingFilters`. Public input is
permissive: unknown values are dropped and parsing does not throw. Seniority
and company accept repeated parameters or comma-separated strings, then trim,
lowercase, deduplicate, and preserve order. Company is an open set of public
slugs capped at the first 10 values.

```ts snippet
import {
  DEFAULT_SORT,
  parseListingFilters,
} from '@cavuno/board/filters';

const filters = parseListingFilters(rawSearchParams);
const selectedSort = filters.sort ?? DEFAULT_SORT;

const page = await board.jobs.list({
  limit: 20,
  seniority: filters.seniority,
  companySlug: filters.company,
  remoteOption: filters.remoteOption ? [filters.remoteOption] : undefined,
  employmentType: filters.employmentType
    ? [filters.employmentType]
    : undefined,
});
```

Company slugs are the URL identity. Map `filters.company` directly to
`companySlug` in `jobs.list` queries or `jobs.search` filters.

## Render controls from the vocabulary

```ts snippet
import {
  EMPLOYMENT_TYPES,
  JOB_SORTS,
  REMOTE_OPTIONS,
  SENIORITIES,
  seniorityLabels,
  sortLabels,
} from '@cavuno/board/filters';

const { language } = await board.context();
const seniorityCopy = seniorityLabels(language);
const sortCopy = sortLabels(language);
```

Render seniority as a multi-select with all eight `SENIORITIES`.
`EMPLOYMENT_TYPES` contains five listing options; `volunteer` and `other`
remain valid job wire values but are absent from the filter control.
`JOB_SORTS` contains exactly `relevance`, `newest`, and `salary_high`;
`relevance` is the featured-ranked default. Sort labels follow the board copy
catalog and operator overrides supplied to `sortLabels`.

## Load taxonomy options

Category and skill collections contain terms backed by published jobs. Each
term already carries a board-language `displayName`, immutable English
`sourceSlug` for filtering, and board-language `canonicalSlug` for links.

```ts snippet
const categories = await board.taxonomy.categories.list({ limit: 50 });
const skills = await board.taxonomy.skills.list({ limit: 50 });

const categoryOptions = categories.data.map((term) => ({
  label: term.displayName,
  filterValue: term.sourceSlug,
  href: `/jobs/${term.canonicalSlug}`,
}));
```

Category and skill lists accept `q`, `limit` (1–100), and opaque `cursor`.
Pass `nextCursor` unchanged to the next request.

```ts snippet
const first = await board.taxonomy.categories.list({ limit: 50 });
const second = first.nextCursor
  ? await board.taxonomy.categories.list({
      limit: 50,
      cursor: first.nextCursor,
    })
  : null;
```

Keyword suggestions accept `q` and `limit`. A present query shorter than two
characters returns no results. Suggestions contain categories and skills only;
because both types may share a slug, key each option by
`type + canonicalSlug`.

```ts snippet
const suggestions = await board.taxonomy.suggestions.list({
  q: searchText,
  limit: 10,
});
```

The host router owns URL serialization and saved-filter persistence.
Locations come from `board.taxonomy.places` rather than a static filter export.

## Completion gate

Finish only after every applicable check passes:

- `/jobs?seniority=Senior,%20lead&sort=oldest` selects senior and lead, falls
  back to `DEFAULT_SORT`, and passes no invalid value to the SDK.
- The seniority control has all eight localized levels and supports multiple
  selections.
- The employment control has five options; the sort control has exactly
  relevance, newest, and salary high.
- Category and skill filtering sends `sourceSlug`, while links use
  `canonicalSlug`.
- Every paged taxonomy request forwards the previous opaque `nextCursor`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
