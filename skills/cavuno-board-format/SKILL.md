---
name: cavuno-board-format
description: Board-language display formatting with @cavuno/board/format. Use for salary ranges, dates, custom-field display, or salary-stat numbers.
---

# Display formatting

`@cavuno/board/format` matches the hosted board's display rules for
**contract and data-shaping** helpers. Chrome words (enum→label, uiCopy,
salary lexicon) are application-owned and are not exported here.

Read the board language once and pass it as the required first argument to
every label-producing helper.

Filter controls use `cavuno-board-filters`. Salary values remain in their wire
currency and retain their server-computed amounts.

## Format job and blog fields

```ts snippet
import {
  formatDate,
  formatPublishedRelativeDate,
  formatSalaryRange,
  formatSalaryStat,
  formatSalaryStatRange,
  resolveCustomFieldDisplay,
} from '@cavuno/board/format';

const { language } = await board.context();

const salary = formatSalaryRange(
  language,
  job.salaryMin,
  job.salaryMax,
  job.salaryTimeframe,
  job.salaryCurrency);
// salary: { text, timeframe, bound: 'range' | 'from' | 'upTo' } | null
// Pieces — application composes order (do not paste a join template):
// text       = Intl amount/range (e.g. "$90–120K", "90.000–120.000 €")
// timeframe  = the WIRE ENUM ("per_year" … "per_hour") or null —
// never a word. Map it through your own catalog.
// bound      = which open-range chrome word to attach, if any
// When joining text + timeframe (or any mixed-direction operands), isolate
// each side: U+2066 FSI … U+2069 PDI, or HTML <bdi> / dir="auto".
// Small rates default to standard by magnitude (|value| < 1000) so
// cents survive: formatSalaryRange(lang, 22.5, null, 'per_hour', 'USD')
// → { text: "$22.50", timeframe: "per_hour", bound: "from" }
// Pass notation 'compact' only when you want forced compact glue.
formatPublishedRelativeDate(language, job.publishedAt);
formatDate(language, job.publishedAt);

// Salary-page stats (currency required — not USD-hardcoded).
// notation matches formatSalaryRange: omit for magnitude default
// (|value| ≥ 1000 → compact; smaller → standard). Pass 'standard' for
// full figures ($90,000) or 'compact' to force short form.
formatSalaryStat(language, 90000, detail.currency);
formatSalaryStatRange(language, 90000, 120000, detail.currency);
formatSalaryStatRange(language, 90000, 120000, detail.currency, 'standard');

// Custom fields — language first. number → kind: 'number' (raw);
// multi_select → kind: 'multi_select' with values: string[] (labels).
// Do not String(n). Do not join multi-select in the SDK — app owns list
// style (conjunction / short / chips):
// new Intl.ListFormat(language, { style: 'long', type: 'conjunction' })
// .format(entry.values)
const fields = resolveCustomFieldDisplay(
  language,
  context.customFields.job,
  job.customFieldValues);
```

`formatPublishedRelativeDate` produces the short relative value used on job
cards and the job-detail header (locale-owned RTF `style: 'short'`). `formatDate`
and `formatMonthYear` produce UTC-pinned absolute forms for blog metadata
and detail facts.

The salary timeframe ships as the wire enum on `timeframe` alone —
not glued to `text` with a space or `/`. Open-range chrome is also
application-owned via `bound`. Compose amount, unit, and chrome in
board-language order (prefix, postfix, particles, no-space gluing for ja/zh),
with bidi isolation when directions may differ.

Missing/`null` currency is not treated as USD: helpers return `null`. Pass the
job's real `salaryCurrency`. Invalid or unsupported locales return `null`
rather than English or host-default fallbacks; underscore tags like `ja_JP`
are normalized to BCP-47 and checked with `Intl.NumberFormat.supportedLocalesOf`.

## Saved-job cards

`me/saved-jobs` embeds the same slim `job_card` as the jobs list. Map it with
the same card view-model as listings — do not convert a full job client-side.

```ts snippet
// saved.job is already PublicJobCard
const card = toJobCardVM(saved.job, { language, /* … */ });
```

## Badges on job cards

Every job card (listings, search, company jobs, similar, recommended, and
saved jobs) carries `customFieldValues` for the job and
`company.customFieldValues` for its company. Both hold only select, boolean,
and number values keyed by field key; select values are option keys. Text
fields stay on the full job and company, and private company fields never
appear. Both are `{}` when empty, so a card needs no extra request to show a
badge.

```ts snippet
import { resolveCustomFieldDisplay } from '@cavuno/board/format';

const context = await board.context();
const companyFields = await board.profileFields.retrieve('company');

// Badge only the fields the operator wants on cards (an app-config list).
const JOB_BADGE_KEYS = ['work_type'];
const jobBadges = resolveCustomFieldDisplay(
  context.language,
  context.customFields.job.filter((field) => JOB_BADGE_KEYS.includes(field.key)),
  card.customFieldValues).flatMap((entry) => {
  switch (entry.kind) {
    case 'text': // a single_select resolves to its option label
      return [entry.value];
    case 'multi_select':
      return entry.values;
    case 'boolean':
      return entry.value ? [entry.label] : [];
    case 'number':
      return [`${entry.label}: ${entry.value}`];
  }
});

// Company badge: resolve the stored option key to its public label.
const employerField = companyFields.definitions.find(
  (field) => field.key === 'employer_category');
const employerKey = card.company?.customFieldValues.employer_category;
const employerBadge =
  typeof employerKey === 'string'
    ? (employerField?.options?.find((option) => option.key === employerKey)
        ?.label ?? null)
    : null;
```

Load the definitions once per page (both are cacheable board metadata), not
once per card. A key with no current definition or option resolves to nothing:
drop the badge rather than printing the raw key.

## Completion gate

Finish only after every applicable check passes:

- Every label-producing call receives `board.context().language`; no call site
  substitutes a hardcoded locale or relies on a silent `en` default.
- Amount and timeframe stay separate until the application joins them; the SDK
  does not emit a pre-joined `"$90K / year"`.
- Open ranges return `bound: 'from' | 'upTo'`; the application adds open-range
  chrome and composes order itself.
- Saved jobs arrive as cards; no `fullJobToCard` conversion.
- Card badges read `card.customFieldValues` / `card.company.customFieldValues`
  and resolve option keys to labels through the definitions; no raw key is
  shown and no card triggers a per-job detail fetch.
- Salary-stat formatters receive the detail's `currency` (never invent USD).
- Formatting changes neither salary amounts nor invents chrome words.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
