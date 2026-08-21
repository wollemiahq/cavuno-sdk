# Salary rich results

Read this reference for salary structured data, `ItemList`, FAQ, formatters, or
seniority ordering.

## Build a title page

Display-producing helpers require the board language as their leading
argument. Salary money formatters take the detail's `currency` as well —
locale drives digits/grouping; currency is never USD-hardcoded. FAQ helpers
return entry kinds and values; compose question/answer prose from the board's
message catalog (with proper plural rules via `Intl.PluralRules` — never a
two-way `one`/else branch).

```ts snippet
import {
  buildSalaryFaq,
  faqJsonLd,
  formatSalaryStatRange,
  itemListJsonLd,
  sortBySeniority,
  titleSalaryJsonLd,
} from '@cavuno/board/seo';

const { language } = await board.context();
const detail = await board.salaries.titles.retrieve('software-engineer');

// Application owns the finished distribution name (label + word order).
// French: `${entity} ${catalog.seniority[seniority]}`; English often
// `${catalog.seniority[seniority]} ${entity}`; Japanese may omit the space.
const occupation = titleSalaryJsonLd(detail, {
  seniorityName: ({ seniority, entity }) =>
    copy.seniorityName({ seniority, entity }),
});

// Structure only — map kinds to localized FAQ sentences in the app.
// The application owns every word; the snippet shows shape, not copy.
// average carries avgMin/avgMax/currency (raw) + range (compact convenience).
// Prefer the raw figures when FAQ prose wants full notation ($100,000).
const entries = buildSalaryFaq(
  language,
  detail.categoryName,
  detail.overallSalary,
  detail.currency);
const faq = faqJsonLd(
  entries.map((entry) => {
    if (entry.kind === 'average') {
      const range =
        formatSalaryStatRange(
          language,
          entry.avgMin,
          entry.avgMax,
          entry.currency,
          'standard') ?? entry.range;
      return {
        // Application catalog — use Intl.PluralRules for jobCount, never a
        // one/else English plural.
        q: copy.faqQuestion({ kind: 'average', label: entry.label }),
        a: copy.faqAnswer({
          kind: 'average',
          label: entry.label,
          range,
          jobCount: entry.jobCount,
        }),
      };
    }
    return {
      q: copy.faqQuestion({ kind: 'methodology', label: entry.label }),
      a: copy.faqAnswer({ kind: 'methodology', label: entry.label }),
    };
  }));

const range = detail.overallSalary
  ? formatSalaryStatRange(
      language,
      detail.overallSalary.avgMin,
      detail.overallSalary.avgMax,
      detail.currency)
  : null;
const ladder = sortBySeniority(detail.bySeniority);
const index = itemListJsonLd([
  {
    name: detail.categoryName,
    url: 'https://jobs.example.com/salaries/titles/software-engineer',
  },
]);
```

## Select other salary builders

- `skillSalaryJsonLd(detail)` for a skill detail.
- `locationSalaryJsonLd(detail, { occupationUrl })` for a city-level location
  detail — emits an `ItemList` of top categories (not an `Occupation` named
  after the city). Supply absolute URLs to each title salary page.
- `crossAxisSalaryJsonLd(args, { seniorityName? })` for a title/skill and
  location pair.
- `companySalaryJsonLd(detail, { occupationUrl })` for a company overview —
  `ItemList` of categories at that employer (not an occupation named after
  the company).
- `companyCategorySalaryJsonLd(detail, { seniorityName? })` for a
  company-category page (keeps `Occupation`).
- `formatSalaryStat(locale, value, currency, notation?)` /
  `formatSalaryStatRange(locale, min, max, currency, notation?)` for
  salary-page amounts (currency from the detail, not hardcoded USD;
  `formatRange` owns the join when present, else two `format()` calls
  joined with an en-dash). `notation` matches `formatSalaryRange`
  (magnitude default when omitted; pass `'standard'` for full figures).
  Returns `null` when currency is empty or `Intl` rejects inputs.
- `SENIORITY_ORDER` / `sortBySeniority` for seniority ladder ordering
  (display names are application-owned via `seniorityName`).

JSON-LD `name` fields are data labels (entity and category names).
Per-seniority distribution names come only from `seniorityName`; when that
callback is omitted, those distributions ship without a `name`. Do not expect
English framing such as "salary (all levels)" or "Average Salary in …" from
the SDK — put those words in the app if a board still wants them.

The structured-data families are `Occupation` (title, skill, cross-axis,
company-category), `ItemList` (location overview, company overview, indexes),
`MonetaryAmountDistribution`, and `FAQPage`. Feed them the SDK salary read
model; preserve nullable aggregates and server-computed values.

This branch is complete when every applicable schema object has the expected
schema.org type, null aggregates produce no fabricated figure, the board
language comes from context, FAQ prose comes from the application catalog
with proper plural rules, and every displayed value traces to a response
field.
