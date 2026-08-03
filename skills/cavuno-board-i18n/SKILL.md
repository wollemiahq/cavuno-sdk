---
name: cavuno-board-i18n
description: One-seam board localization with @cavuno/board. Use when localizing UI chrome, adding locale routing, merging operator labels, or preserving board-language content.
---

# One-seam board localization

A Cavuno board has one content language: `board.context().language`. Jobs, companies, and blog content remain in that API-served language. Multi-locale frontends localize chrome—labels, headings, filters, and FAQ scaffolding—plus entity data the API already translates, such as taxonomy, places, and salary names.

## Build the copy seam

All UI strings resolve through one application module. Layer copy in this order:

1. `uiCopy(language)` provides the versioned `en`, `de`, and `fr` catalog, including functions for pluralized keys.
2. `board.context().labels` overlays operator-specific labels.
3. Generated application copy overlays both when the builder ejects native code.

```ts snippet
import {
  uiCopy,
  type BoardLabelOverrides,
} from '@cavuno/board/format';

export function boardCopy(
  language: string | undefined,
  labels?: BoardLabelOverrides) {
  return uiCopy(language, labels);
}
```

Components import this seam rather than the catalog. That keeps the catalog-to-generated-code transition to one module.

## Add locales

Use the installed framework and i18n guidance for routing, SSR locale detection, link rewriting, and compiled messages. Keep the board language unprefixed at `/` and prefix additional locales such as `/de/` or `/fr/`. Preserve these Cavuno invariants while doing so:

1. Generate locale messages from `uiCopy(locale)` so reviewed SDK copy remains the translation source. This step is complete when every supported locale's chrome keys are generated from the catalog.
2. Point the seam at the URL locale and merge the current board's label overrides. This step is complete when switching locale changes chrome while retaining operator labels.
3. Keep API content in `board.context().language`. This step is complete when locale switching leaves job, company, and blog fields unchanged.
4. Emit locale-aware `<html lang>`, canonical URLs, `hreflang`, and sitemap entries. This step is complete when each public locale route declares itself and all alternates consistently.

A compile-time i18n system can replace the seam's backing source. Keep the seam provider-free unless the chosen framework integration itself requires a provider.

## Completion gate

- Every authored chrome string enters components through the copy seam.
- `uiCopy` plus `board.context().labels` resolves the expected operator override.
- Each supported locale renders translated chrome at its public URL.
- Switching locale preserves API-served job, company, and blog content.
- Server HTML uses the active locale in `<html lang>` with no hydration mismatch.
- Canonical, `hreflang`, and sitemap URLs agree for every locale route.
- Missing translation keys fail generation or tests rather than appearing as raw keys.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
