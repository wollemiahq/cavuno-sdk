---
name: cavuno-board-suggest
description: Federated keyword search suggestions with the @cavuno/board SDK — board.search.suggest for companies + taxonomy terms in one server-ranked list, and the headless createSuggestController under @cavuno/board/suggest (debounce, abort, stale-drop). Use when building a search dropdown, typeahead, or autocomplete that mirrors the hosted board.
---

# Search suggest: dropdown typeahead

`board.search.suggest` returns ONE interleaved, server-ordered list of
company and taxonomy-term suggestions for a keyword — the hosted search
dropdown contract. `@cavuno/board/suggest` wraps that call in a headless
controller so debounce / abort / stale-drop ship with the SDK and patch via
npm update.

## When to use

- The global search input's suggestion dropdown.
- Any typeahead that should offer companies and category/skill terms
  together, ranked the way the hosted board ranks them.

## When not to use

- Location autocomplete — `board.taxonomy.places.list({ q })`.
- Taxonomy-only option lists for filter sidebars —
  `board.taxonomy.categories/skills/suggestions.list`.
- Job results themselves — `board.jobs.list` / `board.jobs.search`.

## Call the endpoint directly

```ts snippet
const { items, query } = await board.search.suggest({ q: 'acme', limit: 10 });
// items is server-ranked — do NOT re-sort.
for (const item of items) {
  if (item.type === 'company') {
    item.slug; // public company URL slug
    item.name;
    item.jobCount;
  } else {
    // item.type === 'term'
    item.termType; // 'category' | 'skill'
    item.displayName;
    item.canonicalSlug; // for links
    item.sourceSlug; // for job filters
  }
}
```

Queries under two characters return an empty `items` array. `limit` is
1–25 (default 25). Order is the contract.

## Prefer the headless controller for UI

The controller owns debounce (default 250ms), min-chars (default 2),
in-flight abort, and stale-drop. Compatible with `useSyncExternalStore`.

```ts snippet
import { createSuggestController } from '@cavuno/board/suggest';

const suggest = createSuggestController(board, { limit: 10 });
const unsub = suggest.subscribe(() => {
  const { items, status, query } = suggest.getState();
  // render dropdown; previous items are retained while status === 'loading'
});
suggest.setQuery(inputValue);
// Hide the currently-applied company filter from the list:
suggest.setExcludedCompanySlugs(appliedCompanySlugs);
// teardown:
unsub();
suggest.dispose();
```

`setExcludedCompanySlugs` is the ONE permitted view-level filter (company
items only, re-filters current items synchronously — no new request). Never
reshape or re-sort the rest of the response.

## Wire a company pick into the listing

Company slugs are the URL identity. Map them onto the jobs surface as
`companySlug` — never resolve slug→id client-side:

```ts snippet
import { parseListingFilters } from '@cavuno/board/filters';

const filters = parseListingFilters(rawSearchParams);
// filters.company is string[] of public slugs

const page = await board.jobs.list({
  limit: 20,
  companySlug: filters.company,
});
```

Unknown slugs are dropped server-side (not an error). If the entire company
filter resolves to no known companies, the listing is empty (`count: 0`).
Combined with `companyId` as a union when both are set.

## Anti-patterns

```ts no-check
// NEVER re-sort server-ranked items:
items.sort((a, b) => a.name.localeCompare(b.name));
// NEVER resolve company slug → id on the client:
const id = await lookupCompanyId(item.slug);
board.jobs.list({ companyId: [id] });
// NEVER hand-roll debounce/abort — use the controller so patches ship via npm.
```

## Out of scope — do not invent exports

No React components, no dropdown UI, no keyboard navigation — this package
is the data + controller layer. Location suggest stays on `taxonomy.places`.

## Verify

- [ ] Typing under 2 characters shows no suggestions and no network call
      from the controller.
- [ ] Fast typing cancels the previous request; only the final query's
      results render.
- [ ] Selecting a company writes its public slug into the URL and the
      listing request uses `companySlug`, not a client-resolved id.
