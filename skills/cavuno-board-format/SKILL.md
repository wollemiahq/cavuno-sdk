---
name: cavuno-board-format
description: Display formatting for board frontends with @cavuno/board/format — salary ranges, seniority/employment/remote labels, location labels, dates, and the board-language salary lexicon. Use when rendering job cards, detail pages, or salary figures, and whenever a value like salaryMin/salaryTimeframe/seniority needs to become display text.
---

# Format: board-language display text

`@cavuno/board/format` turns wire values into the exact display text the
hosted board renders — tested against the hosted formatters, so a
tenant frontend cannot drift from the platform's rendering rules.

## When to use

- Rendering salary ranges, dates, locations, or enum labels anywhere.
- Building salary-page metadata sentences (the lexicon frames).

## When not to use

- Filter vocabulary and URL parsing — `cavuno-board-filters`.
- Money math. Never compute or convert amounts client-side; format what the
  wire provides.

## The board language is a required first argument

Every label-producing helper takes the board language — read it once from
context. There is no `en` default: a German-native board must never
silently render English.

```ts snippet
import {
  formatSalaryRange,
  formatPublishedRelativeDate,
  formatDate,
  fieldLabel,
} from '@cavuno/board/format';

const { language } = await board.context();

formatSalaryRange(language, job.salaryMin, job.salaryMax, job.salaryTimeframe, job.salaryCurrency);
// en: "$90K – $120K Yearly" · de: "90.000 € – 120.000 € pro Jahr"
formatPublishedRelativeDate(language, job.publishedAt); // "5d ago" — what job CARDS render
formatDate(language, job.publishedAt); // "Jun 24, 2026" — blog metadata / detail facts (UTC-pinned)
fieldLabel(language, job.seniority);   // de: 'executive' → "Führungskraft"
```

Job cards and the job-detail header show the RELATIVE form; the absolute
medium date is for blog metadata and detail fact rows — matching hosted.

Localization matches hosted exactly: seniority + timeframe words are
localized (en+de lexicon, other locales fall back to English words with
locale-correct number formatting); employment/remote labels are English on
every board because hosted ships no other vocabulary yet.

## Location labels

Cards carry server-computed labels — use them via `cardLocationLabel`. Only
the full `PublicJob` needs client-side derivation:

```ts snippet
import { cardLocationLabel, locationLabel, fullJobToCard } from '@cavuno/board/format';

cardLocationLabel(language, card);   // "Remote · Europe" | "Berlin, Germany"
locationLabel(language, job);        // full PublicJob (detail page)
const card = fullJobToCard(language, job); // embed a saved job in a card list
```

## Salary lexicon (metadata sentences)

`getSalaryLexicon(language)` exposes the words and the `<title>`/meta
sentence frames the hosted salary pages use:

```ts snippet
import { getSalaryLexicon } from '@cavuno/board/format';

const lexicon = getSalaryLexicon(language);
lexicon.frames.entitySalariesTitle({ entity: 'JavaScript', range: '$70K – $90K' });
// "JavaScript Salaries ($70K – $90K/yr)"
lexicon.seniority.senior; // "Senior"
```

## Anti-patterns

```ts no-check
// NEVER hand-format money — symbol placement and words are locale rules:
`$${(job.salaryMin / 1000).toFixed(0)}k`;          // wrong on de boards
// NEVER default the locale:
formatSalaryRange('en', ...);                      // hardcoded 'en' on a de board
// NEVER rebuild card location labels from scratch — the wire pre-computes them.
```

## Out of scope — do not invent exports

No currency conversion, no relative-time ("3 days ago") helper, no
number-only formatter — the SDK formats exactly what the hosted board
formats. Sort-dropdown copy lives in `cavuno-board-filters`.

## Verify

- [ ] A de board renders "pro Jahr"/"ab"/"Führungskraft" where an en board
      renders "Yearly"/"From"/"Executive" — same code path, different
      `language`.
- [ ] An en board's salary strings are byte-identical to the hosted board's
      for the same job.
- [ ] No call site passes a hardcoded locale string.
