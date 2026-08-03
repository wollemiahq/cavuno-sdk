---
name: cavuno-board-format
description: Board-language display formatting with @cavuno/board/format. Use for salary ranges, dates, job labels, location labels, card conversion, or salary metadata copy.
---

# Display formatting

`@cavuno/board/format` matches the hosted board's display rules. Read the
board language once and pass it as the required first argument to every
label-producing helper.

Filter controls use `cavuno-board-filters`. Salary values remain in their wire
currency and retain their server-computed amounts.

## Format job and blog fields

```ts snippet
import {
  fieldLabel,
  formatDate,
  formatPublishedRelativeDate,
  formatSalaryRange,
} from '@cavuno/board/format';

const { language } = await board.context();

formatSalaryRange(
  language,
  job.salaryMin,
  job.salaryMax,
  job.salaryTimeframe,
  job.salaryCurrency);
formatPublishedRelativeDate(language, job.publishedAt);
formatDate(language, job.publishedAt);
fieldLabel(language, job.seniority);
```

`formatPublishedRelativeDate` produces the compact relative value used on job
cards and the job-detail header, such as `5d ago`. `formatDate` produces the
UTC-pinned medium date used in blog metadata and detail facts, such as
`Jun 24, 2026`. This format surface limits relative time to the compact
job-publication label.

Salary timeframe and seniority copy is localized for English and German;
other locales use English words with locale-correct number formatting.
Employment and remote labels remain English across board languages because
the hosted board currently has no translated vocabulary for them.

## Render locations and saved-job cards

Cards already contain server-computed location labels. Full `PublicJob`
detail requires the full-job formatter. Convert a full saved job before
placing it in a card collection.

```ts snippet
import {
  cardLocationLabel,
  fullJobToCard,
  locationLabel,
} from '@cavuno/board/format';

cardLocationLabel(language, card);
locationLabel(language, job);
const savedCard = fullJobToCard(language, job);
```

## Build salary metadata copy

`getSalaryLexicon` exposes hosted salary terminology and sentence frames.

```ts snippet
import { getSalaryLexicon } from '@cavuno/board/format';

const lexicon = getSalaryLexicon(language);
lexicon.frames.entitySalariesTitle({
  entity: 'JavaScript',
  range: '$70K – $90K',
});
lexicon.seniority.senior;
```

Use the helpers as the formatting boundary: pass the board language, wire
amounts, wire currency, and server location data in; render the returned text.
This keeps symbol placement, timeframe copy, number rules, and hosted labels
aligned. Sort-dropdown copy remains in `cavuno-board-filters`.

## Completion gate

Finish only after every applicable check passes:

- Every label-producing call receives `board.context().language`; no call site
  substitutes a hardcoded locale.
- A German board renders `pro Jahr`, `ab`, and `Führungskraft` where the same
  path renders `Yearly`, `From`, and `Executive` in English.
- English salary strings are byte-identical to the hosted board for the same
  wire job.
- Cards use `cardLocationLabel`; full jobs use `locationLabel`; saved full jobs
  are converted with `fullJobToCard` before card rendering.
- Formatting changes neither salary amounts nor currency.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
