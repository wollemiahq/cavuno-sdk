---
name: cavuno-board-search-suggestions
description: Build server-ranked search suggestions with @cavuno/board. Use for company-and-term typeahead, autocomplete dropdowns, or suggestion-controller wiring.
---

# Server-ranked search suggestions

`board.search.suggest` returns one interleaved list of companies, markets, taxonomy terms, blog posts, and tags. Pass `types` to restrict kinds; `limit` applies after that filter. Server rank is the contract: render its order unchanged. For UI, the headless controller adds debounce, abort, and stale-result dropping.

Location autocomplete uses `board.taxonomy.places.list({ q })`; filter option lists use `board.taxonomy.categories.list` or `board.taxonomy.skills.list`; job results use `board.jobs.list` or `board.jobs.search`. Route a selected suggestion with `suggestionPath` from `@cavuno/board/paths`.

## Read suggestions

```ts snippet
const { items, query } = await board.search.suggest({
  q: 'acme',
  limit: 10,
  types: ['company', 'skill', 'category'],
});

for (const item of items) {
  if (item.type === 'company') {
    item.slug;
    item.name;
    item.jobCount;
  } else if (item.type === 'market') {
    item.slug;
    item.name;
    item.companyCount;
  } else {
    item.termType;
    item.displayName;
    item.canonicalSlug;
    item.sourceSlug;
  }
}
```

Queries shorter than two characters return no items. `limit` accepts 1–25 and defaults to 25. `{ types: ['skill'], limit: 10 }` returns up to ten skills.

Term suggestions have `termType: 'category' | 'skill'`; use `canonicalSlug` for links and `sourceSlug` for job filters.

## Drive UI with the controller

```ts snippet
import { createSuggestController } from '@cavuno/board/suggest';

const suggest = createSuggestController(board, { limit: 10 });
const unsubscribe = suggest.subscribe(() => {
  const state = suggest.getState();
  renderSuggestions(state.items, state.status, state.query);
});

suggest.setQuery(inputValue);
suggest.setExcludedCompanySlugs(appliedCompanySlugs);

unsubscribe();
suggest.dispose();
```

Defaults are a 250 ms debounce and two-character minimum. Previous items remain while status is `loading`. The store is compatible with `useSyncExternalStore`. `setExcludedCompanySlugs` is the view-level exception: it removes company items synchronously without requesting again. Preserve the remaining items and order.

The SDK provides the data and controller, while the host owns dropdown markup, keyboard navigation, and framework bindings.

## Apply a company suggestion

Company slugs are public URL identity. Write the slug into listing filters and pass it as `companySlug`.

```ts snippet
import { parseListingFilters } from '@cavuno/board/filters';

const filters = parseListingFilters(rawSearchParams);
const page = await board.jobs.list({
  limit: 20,
  companySlug: filters.company,
});
```

Unknown slugs are dropped server-side. If none resolve, the listing has `count: 0`. When `companySlug` and `companyId` are both present, the server uses their union.

## Completion gate

- A controller query below two characters renders no results and makes no request.
- Rapid typing renders only the final response.
- Excluded companies disappear without changing the relative order of other items.
- Selecting a company writes its slug to the URL and sends `companySlug` directly.
- Teardown unsubscribes listeners and calls `dispose`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
