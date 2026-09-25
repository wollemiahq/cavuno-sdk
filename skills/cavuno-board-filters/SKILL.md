---
name: cavuno-board-filters
description: Listing-filter contracts with @cavuno/board. Use for job filter controls, profile-field filters, collection choices, sort controls, listing URL validation, or taxonomy-backed filter options.
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

## Filter by category in search

An "All filters" panel can carry a category facet next to seniority, company,
workplace and employment type. `parseListingFilters` reads `category` the same
way as company (repeated or comma-separated slugs, first 10 kept). Send it as
`filters.categories` in a `jobs.search` body; a job matches when it has any of
the given categories, and the other filters still apply.

```ts snippet
const results = await board.jobs.search({
  query: filters.q,
  sort: filters.sort,
  filters: {
    categories: filters.category,
    seniority: filters.seniority,
    companySlug: filters.company,
    remoteOption: filters.remoteOption ? [filters.remoteOption] : undefined,
  },
  limit: 20,
});
```

`categories` accepts a term's `sourceSlug` or its board-language
`canonicalSlug`; an unknown slug matches no jobs. `jobs.list` takes a single
`category` instead, which seeds a category landing page rather than filtering
a search. Use `jobs.search` whenever the category is one facet among several.

## Render controls from the vocabulary

```ts snippet
import {
  EMPLOYMENT_TYPES,
  JOB_SORTS,
  REMOTE_OPTIONS,
  SENIORITIES,
} from '@cavuno/board/filters';

// Wire enums only — display labels are application-owned chrome.
const seniorityOptions = SENIORITIES;
const sortOptions = JOB_SORTS;
```

Render seniority as a multi-select with all eight `SENIORITIES`.
`EMPLOYMENT_TYPES` contains five listing options; `volunteer` and `other`
remain valid job wire values but are absent from the filter control.
`JOB_SORTS` contains exactly `relevance`, `newest`, and `salary_high`;
`relevance` is the featured-ranked default. Label each option with your
application's copy (message catalog or hard-coded board language).

## Load taxonomy options

Category and skill collections contain terms backed by published jobs. Each
term already carries a board-language `displayName`, immutable English
`sourceSlug` for filtering, board-language `canonicalSlug` for links, and
a live `jobCount` (published jobs on the board — not a tally of the current
list page).

```ts snippet
const categories = await board.taxonomy.categories.list({ limit: 50 });
const skills = await board.taxonomy.skills.list({ limit: 50 });

const categoryOptions = categories.data.map((term) => ({
  label: term.displayName,
  filterValue: term.sourceSlug,
  href: `/jobs/${term.canonicalSlug}`,
  jobCount: term.jobCount,
}));
```

For homepage "browse by category" tiles, ask for the busiest terms rather
than the first page of the name-sorted collection:

```ts snippet
const top = await board.taxonomy.categories.list({
  limit: 8,
  sort: 'jobCount',
});
```

Category and skill lists accept `q`, `limit` (1–100), `sort` (`name` or
`jobCount`), and opaque `cursor`. Pass `nextCursor` unchanged to the next
request. The cursor is bound to `q`, `limit`, and `sort`.

```ts snippet
const first = await board.taxonomy.categories.list({ limit: 50 });
const second = first.nextCursor
  ? await board.taxonomy.categories.list({
      limit: 50,
      cursor: first.nextCursor,
    })
  : null;
```

Keyword suggestions accept `q`, `limit`, and optional `types`. A present query
shorter than two characters returns no results. Restrict to taxonomy terms with
`types: ['category', 'skill']`; because both may share a slug, key each option
by `termType + canonicalSlug`.

```ts snippet
const { items } = await board.search.suggest({
  q: searchText,
  limit: 10,
  types: ['category', 'skill'],
});
```

The host router owns URL serialization and saved-filter persistence.
Locations come from `board.taxonomy.places` rather than a static filter export.

## Filter jobs by a job custom field

The operator's job custom fields arrive as definitions on
`board.context().customFields.job`. Expose a field as a filter only when the
operator intends it as one: keep an explicit list of filter keys in your app
config. Do not render a dropdown for every select field automatically; most
custom fields are details for the job page, not listing facets.

```ts snippet
const context = await board.context();

// The operator picked these; everything else stays a job-page detail.
const FILTER_FIELD_KEYS = ['work_type'];
const filterFields = context.customFields.job.filter(
  (field) =>
    FILTER_FIELD_KEYS.includes(field.key) &&
    (field.type === 'single_select' || field.type === 'multi_select'));

// Controls: option KEYS are the values, option labels are the text.
const controls = filterFields.map((field) => ({
  key: field.key,
  label: field.label,
  options: (field.options ?? []).map((option) => ({
    value: option.key,
    label: option.label,
  })),
}));

// URL state holds option keys (`/jobs?work_type=contract`), never labels.
// Drop anything that is not a current option before it reaches the API.
const customFields = filterFields.flatMap((field) => {
  const values = searchParams
    .getAll(field.key)
    .filter((value) => field.options?.some((option) => option.key === value));
  return values.length > 0 ? [{ key: field.key, values }] : [];
});

const results = await board.jobs.search({
  query: filters.q,
  filters: {
    seniority: filters.seniority,
    customFields: customFields.length > 0 ? customFields : undefined,
  },
  limit: 20,
});
```

Clauses are AND-matched; values inside one clause are alternatives. Each
request takes at most 10 clauses of 10 values. An unknown key or an option key
the field no longer offers returns `invalid_filter`, so validate URL input
against the definitions as above. Boolean and number fields filter the same way
with `values: [true]` or `values: [3]`. Labels change when the operator renames
an option; keys do not, so bookmarked URLs keep working.

## Build filters from public profile fields

`board.profileFields.retrieve('company')` and `retrieve('candidate')` return only public scalar and collection-reference definitions. Use each stored field key for filtering. For a collection reference, page or search its active public choices and submit the returned record `id`; the optional `logoUrl` is display metadata.

```ts snippet
const companyFields = await board.profileFields.retrieve('company');
const technologyChoices = await board.profileFields.choices(
  'company',
  'technologies',
  { search: 'typescript', limit: 20 });

const companies = await board.companies.search({
  query: 'engineering',
  customFields: [{ key: 'member_tier', values: ['gold'] }],
  objectReferences: [
    { key: 'technologies', recordIds: [technologyChoices.data[0]!.id] },
  ],
});

const candidateFields = await board.profileFields.retrieve('candidate');
const certifications = await board.profileFields.choices(
  'candidate',
  'certifications',
  { limit: 20 });
const talent = await board.talent.list({
  customFields: [{ key: 'available_for_mentoring', values: [true] }],
  objectReferences: [
    { key: 'certifications', recordIds: [certifications.data[0]!.id] },
  ],
});

void companyFields.definitions;
void candidateFields.referenceDefinitions;
void companies.data;
void talent.data;
```

Clauses are AND-matched. Values or record IDs inside one clause are alternatives. Unknown, private, invalid, or archived choices return `invalid_filter`; each array accepts at most 10 clauses and each clause at most 10 choices. Job search supports scalar `customFields` under `filters`, but job collection references are outside this surface.

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
- `/jobs?category=engineering,design` sends
  `filters.categories: ['engineering', 'design']` to `jobs.search`.
- Every paged taxonomy request forwards the previous opaque `nextCursor`.
- Job custom-field controls exist only for keys the operator chose as
  filters, read their options from `board.context().customFields.job`, and send
  option keys in `filters.customFields`; an unknown option in the URL never
  reaches the API.
- Company and talent custom controls come from `board.profileFields`; private definitions and archived choices never become filter options.
- Profile-filter requests use stored scalar values and returned collection entry IDs, not display labels.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
