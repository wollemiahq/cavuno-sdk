---
name: cavuno-board-i18n
description: Multi-language chrome for a board frontend — the single-language board model, the uiCopy catalog ⊕ operator labels ⊕ generated copy layering, the one copy seam, and how to add path-prefixed locales (/de/, /fr/) with Paraglide JS on TanStack Start. Use when localizing a starter's chrome, adding a language, or wiring locale routing. Do NOT use to translate job content — that stays the board's language.
---

# Board i18n: localize the chrome, never the content

A Cavuno board has **one content language** (`board.context().language`).
Job titles, descriptions, and company text are that single language and
never translated by the frontend. What you localize is the **chrome** —
labels, headings, FAQ scaffolding, filter vocabulary — plus the entity
data the API already translates (taxonomy, places, salary names).

So there are two separate things:
- **Content** (jobs, companies, blog): board-language, API-served, single.
- **Chrome** (your authored UI strings): can be multi-locale, path-routed.

## The copy layers (resolve in order)

1. **`uiCopy(language)`** — the versioned SDK catalog (`@cavuno/board/format`,
   `en`/`de`/`fr`, functions-per-key for plurals; no runtime, no provider).
   The floor.
2. **`⊕ board.context().labels`** — the operator's per-board overrides,
   API-served (e.g. `featuredLabel` → "Top Job").
3. **`⊕ generated code`** — per-board copy the AI builder ejects to native
   code. Supersedes the catalog for that board.

Every surface resolves copy through **one seam module** (`src/copy.ts`),
never by calling the catalog inline:

```ts snippet
import { uiCopy, type BoardLabelOverrides } from '@cavuno/board/format'
export function boardCopy(language: string | undefined, labels?: BoardLabelOverrides) {
  return uiCopy(language, labels)
}
```

The seam is the **single swap point** for the whole copy lifecycle: catalog
today → Paraglide messages (below) → builder-generated code later. Components
never change; only the seam's backing source does.

## Add path-prefixed locales with Paraglide JS (TanStack Start)

The starters are TanStack Start, and the TanStack-recommended i18n is
**Paraglide JS** — compile-time (messages become tree-shakeable functions),
**no runtime provider** (matches the catalog's no-provider stance), with
built-in locale routing. The board's language is served unprefixed at `/`;
extra locales are prefixed (`/de/`, `/fr/`).

1. **Init.** `npx @inlang/paraglide-js@latest init` — creates the inlang
   project, `messages/{en,de,fr}.json`, the `paraglide/` output, and the Vite
   plugin. Add the plugin to `vite.config.ts`.
2. **Generate messages FROM `uiCopy` — never hand-translate.** The catalog is
   the source of truth. Emit `messages/{locale}.json` from
   `uiCopy(locale)` so `de`/`fr` come from the reviewed SDK catalog, not a
   second copy. (This generator is the `uiCopy → Paraglide` adapter.)
3. **Route.** Wire the router's `rewrite` with Paraglide's `deLocalizeUrl` /
   `localizeUrl` so `/de/jobs` routes internally as `/jobs` and every `Link`
   auto-prefixes the active locale. Default-locale-no-prefix: the board
   language stays at `/`.
4. **SSR.** Add `paraglideMiddleware` in the server entry; set `<html lang>`
   from `getLocale()` (it replaces the static `board.language` in the root).
5. **Seam.** Point `boardCopy` at the URL locale (`getLocale()`) instead of
   only `board.language`, so `/de/` renders German chrome even on an English
   board. This is the opt-in over the single-language model.
6. **SEO slice.** Per-locale `hreflang`, canonical, and sitemap entries are
   part of completing multi-language — do them when you add real locales, not
   in the foundation.

## Do not

- **Do not translate job content** (titles/descriptions). Fully multi-language
  listings is a data-model change, out of scope.
- **Do not hand-author translations** in the starter — generate messages from
  `uiCopy` so there is one reviewed source.
- **Do not add a runtime i18n provider** (e.g. use-intl's context). Paraglide
  is compile-time; keep the no-provider property.
- **Do not scatter catalog calls** through markup — everything imports the one
  seam, so the catalog→code migration is a single-file change.

Wiring flavor: `cavuno-board-tanstack-start`.
