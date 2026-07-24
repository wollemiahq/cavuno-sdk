---
name: cavuno-board-filters
description: The canonical listing-filter vocabulary and URL search-param parsing with @cavuno/board/filters — remote/employment/seniority/company/sort sets, localized seniority labels, and parseListingFilters for jobs-listing routes. Use when building listing pages, filter sidebars, sort dropdowns, or validating listing URL params.
---

# Filters: vocabulary + URL parsing

`@cavuno/board/filters` is the one filter vocabulary every tenant frontend
shares — the seniority set is tested against the platform source, and
URL parsing follows the hosted semantics (hand-typed URLs are messy; parsing
never throws).

## When to use

- The jobs index and every programmatic listing page (category / skill /
  location) — they all layer the same cross-cutting filters on any seed.
- `validateSearch`-style route param validation (server-safe, SSR-ready).

## When not to use

- Turning values into card display text — `cavuno-board-format`.
- Search QUERIES (`jobs.search` bodies) — this module is about the listing
  URL contract, not the search POST body.
- Search-dropdown typeahead — `cavuno-board-suggest`.

## Parse listing URLs

```ts snippet
import { parseListingFilters, DEFAULT_SORT } from '@cavuno/board/filters';

const filters = parseListingFilters(rawSearchParams);
// { q?, remoteOption?, employmentType?, seniority?: Seniority[], company?: string[], sort? }

const page = await board.jobs.list({
  limit: 20,
  seniority: filters.seniority,
  companySlug: filters.company,
  remoteOption: filters.remoteOption ? [filters.remoteOption] : undefined,
  employmentType: filters.employmentType ? [filters.employmentType] : undefined,
});
```

Unknown values are dropped silently (public URLs, never throw). Seniority
and `company` accept repeated params or a comma-string and normalize with
the hosted rules: trim, lowercase, dedupe, keep order. `company` is an open
value set (public slugs) capped at 10 (wire max; first 10 kept).

**Slugs are the URL identity.** Map `filters.company` to the wire as
`companySlug` (`jobs.list` query / `jobs.search` filters). The API accepts
slugs directly — never resolve slug→id client-side.

## Render the filter UI from the vocabulary

```ts snippet
import {
  REMOTE_OPTIONS,
  EMPLOYMENT_TYPES,
  SENIORITIES,
  JOB_SORTS,
  seniorityLabels,
  sortLabels,
} from '@cavuno/board/filters';

const { language } = await board.context();
const labels = seniorityLabels(language); // de: executive → "Führungskraft"
const sorts = sortLabels(language);       // English defaults on every locale
```

Seniority renders as a MULTI-select (hosted parity). `EMPLOYMENT_TYPES`
deliberately offers 5 of the 7 wire values (`volunteer`/`other` exist on
jobs but are not filter options). `JOB_SORTS` deliberately excludes
`oldest`; `relevance` is the featured-ranked default.

## Load category, skill, and keyword options

Use the Board API taxonomy collections for filter/autocomplete options. Items
are backed by published jobs on this board and already carry the board-language
display name and canonical URL slug. Keep `sourceSlug` for job filtering and
`canonicalSlug` for links.

```ts snippet
const categories = await board.taxonomy.categories.list({ limit: 50 });
const skills = await board.taxonomy.skills.list({ limit: 50 });
const suggestions = await board.taxonomy.suggestions.list({
  q: searchText,
  limit: 10,
});

const categoryOptions = categories.data.map((term) => ({
    label: term.displayName,
    filterValue: term.sourceSlug,
    href: `/jobs/${term.canonicalSlug}`,
}));
```

Category and skill lists accept `q`, `limit` (1–100), and the opaque
`cursor` request field. Pass the previous response's `nextCursor` into it:

```ts snippet
const first = await board.taxonomy.categories.list({ limit: 50 });
const second = first.nextCursor
  ? await board.taxonomy.categories.list({
      limit: 50,
      cursor: first.nextCursor,
    })
  : null;
```

Suggestions accept `q` and `limit`;
a present query under two characters returns no suggestions. Suggestions contain
categories and skills only. A category and skill may legitimately share a slug,
so use `type + canonicalSlug` as the option identity.

## Anti-patterns

```ts no-check
// NEVER hand-roll the vocab per page — one page offering 'oldest' or a
// 6th employment type diverges from every other board frontend:
const sorts = ['relevance', 'newest', 'oldest'];
// NEVER trust raw search params into the SDK query:
board.jobs.list({ seniority: rawSearch.seniority });
```

## Out of scope — do not invent exports

No URL BUILDER (routes are app-owned — serialize with your router), no location
taxonomy vocabulary (locations come from `board.taxonomy.places`), no
saved-filter persistence.

## Verify

- [ ] `/jobs?seniority=Senior,%20lead&sort=oldest` renders the senior+lead
      selection and the default sort — no crash, no leaked invalid value.
- [ ] The seniority multi-select shows all 8 levels, labeled in the board
      language.
- [ ] The sort dropdown offers exactly relevance / newest / salary_high.
