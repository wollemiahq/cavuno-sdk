---
name: cavuno-board-i18n
description: One-seam board localization with @cavuno/board. Use when localizing UI chrome, adding locale routing, or preserving board-language content.
---

# One-seam board localization

A Cavuno board has one content language: `board.context().language`. Jobs, companies, and blog content remain in that API-served language. Multi-locale frontends localize chrome—labels, headings, filters, and FAQ scaffolding—plus entity data the API already translates, such as taxonomy, places, and salary names.

## Own the chrome catalog

Applications own chrome words. The SDK does not export a chrome-copy runtime
or seed `messages/`. Keep a typed copy seam in application code
(the starter already commits `messages/*.json` for en/de/fr).

```ts snippet
// Application-owned: load messages/ for the active locale and expose a
// seam components import. Shape is a fixed set of string groups (jobCard,
// jobSearch, jobDetail, apply, alerts, …).
export type BoardCopy = {
  jobCard: { featuredLabel: string; /* … */ };
  // …
};
```

## Build the copy seam

All UI strings resolve through one application module. Prefer compile-time messages (Paraglide / inlang) fed by application-owned `messages/` files:

1. Keep `messages/` in the application (or starter).
2. Compile messages with your framework's i18n tool.
3. Expose one seam modules components import (`src/copy.ts` or equivalent).

Components import this seam rather than reading JSON ad hoc. That keeps the catalog-to-generated-code transition to one module.

## Add locales

Use the installed framework and i18n guidance for routing, SSR locale detection, link rewriting, and compiled messages. Keep the board language unprefixed at `/` and prefix additional locales such as `/de/` or `/fr/`. Preserve these Cavuno invariants while doing so:

1. Start from your application message catalogs so chrome wording is under version control with the app.
2. Point the seam at the URL locale. This step is complete when switching locale changes chrome.
3. Keep API content in `board.context().language`. This step is complete when locale switching leaves job, company, and blog fields unchanged.
4. Emit locale-aware `<html lang>`, canonical URLs, `hreflang`, and sitemap entries. This step is complete when each public locale route declares itself and all alternates consistently.

A compile-time i18n system can replace the seam's backing source. Keep the seam provider-free unless the chosen framework integration itself requires a provider.

## Own the five  obligations

The SDK formats amounts, units, and relative dates with `Intl` and returns
structure. It does **not** ship plural selection, gender agreement, bidi
isolation, grapheme-safe truncation, or locale-aware case mapping. Those
five are application-owned. Satisfying the chrome / routing
gates alone is not enough — a board that ships without plural rules or
bidi isolation still fails this skill.

### Plural selection

Never branch on `count === 1`. Use `Intl.PluralRules` for the active locale
and pick the catalog form for the returned category:

```ts snippet
const pr = new Intl.PluralRules(locale);
// categories: zero | one | two | few | many | other (locale-dependent)
const form = messages.jobCount[pr.select(count)];
// en: { one: "{n} job", other: "{n} jobs" }
// ar: { zero, one, two, few, many, other } — all six can be required
const label = form.replace('{n}', new Intl.NumberFormat(locale).format(count));
```

Use this for every count-bearing chrome string (search results, FAQ sample
sizes, alert copy). Do not hardcode English `-s`.

### Gender agreement

When a catalog string agrees with a person or role (adjectives, participles
in fr/de/ru/…), store gendered variants in the catalog and select by the
entity's gender metadata — do not invent agreement in code from English
stems.

### Bidi isolation

When composing SDK display strings with chrome or with mixed-direction
data (Latin company name inside an RTL sentence is the standard case),
isolate each operand whose direction may differ:

```ts snippet
const FSI = '\u2066'; // FIRST STRONG ISOLATE
const PDI = '\u2069'; // POP DIRECTIONAL ISOLATE
// Prefer HTML <bdi> / dir="auto" in markup; FSI/PDI in plain-text joins.
// `salary.timeframe` is the wire enum (`per_year`) — resolve it through
// your catalog first, then isolate both operands before joining.
const unit = salary.timeframe ? m[`salary_${salary.timeframe}`]() : '';
const line = `${FSI}${salary.text}${PDI} ${FSI}${unit}${PDI}`;
```

Never paste a bare `` `${amount} ${label}` `` into RTL chrome without
isolation. The SDK returns bare `string` values on purpose — isolation is
app-owned at the join site.

### Grapheme-safe truncation

Do not slice with `string.length` / `substring` on user-visible text.
Count grapheme clusters (`Intl.Segmenter` with `granularity: 'grapheme'`,
or a well-tested grapheme library) so emoji ZWJ sequences and combining
marks are not split.

### Locale-aware case mapping

Use `toLocaleLowerCase(locale)` / `toLocaleUpperCase(locale)` for display
case (Turkish `i`/`İ`, Greek final sigma). Keep identifier folding
(`toLowerCase` without locale) only for URL slugs and Set keys — the SDK
does that on purpose.

### Native digits

When formatting numbers the app owns (custom-field `kind: 'number'`,
counts, pagination), use `Intl.NumberFormat(locale)` so native-digit
locales (`ar`, `bn`, `hi-u-nu-deva`, …) render correctly. Never
`String(n)` for display.

## Completion gate

- Every authored chrome string enters components through the copy seam.
- Chrome comes from application messages, not from `board.context()` (the API no longer serves a labels bag).
- Each supported locale renders translated chrome at its public URL.
- Switching locale preserves API-served job, company, and blog content.
- Server HTML uses the active locale in `<html lang>` with no hydration mismatch.
- Canonical, `hreflang`, and sitemap URLs agree for every locale route.
- Missing translation keys fail generation or tests rather than appearing as raw keys.
- Count-bearing chrome uses `Intl.PluralRules` (no `count === 1` English branches).
- Composed display strings that mix directions isolate operands (FSI/PDI or `<bdi>`).
- Visible truncation is grapheme-safe; display case mapping uses the locale.
- App-owned numbers format via `Intl.NumberFormat`, not `String(n)`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
