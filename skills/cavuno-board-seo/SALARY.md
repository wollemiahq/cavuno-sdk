# Salary rich results

Read this reference for salary structured data, `ItemList`, FAQ, formatters, or
seniority ordering.

## Build a title page

Display-producing helpers require the board language as their leading
argument. The salary money formatters intentionally retain the hosted page's
USD assumption; locale changes number formatting, not currency. The current
FAQ uses templated English sentences until board-custom FAQ copy is exposed.

```ts snippet
import {
  buildSalaryFaq,
  faqJsonLd,
  formatRange,
  itemListJsonLd,
  sortBySeniority,
  titleSalaryJsonLd,
} from '@cavuno/board/seo';

const { language } = await board.context();
const detail = await board.salaries.titles.retrieve('software-engineer');

const occupation = titleSalaryJsonLd(language, detail);
const faq = faqJsonLd(
  buildSalaryFaq(language, detail.categoryName, detail.overallSalary));
const range = detail.overallSalary
  ? formatRange(
      language,
      detail.overallSalary.avgMin,
      detail.overallSalary.avgMax)
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
- `locationSalaryJsonLd(detail)` for a city-level location detail.
- `crossAxisSalaryJsonLd(locale, args)` for a title/skill and location pair.
- `companySalaryJsonLd(locale, detail)` for a company overview.
- `companyCategorySalaryJsonLd(locale, detail)` for a company-category page.
- `formatUsd(locale, value)` for the hosted USD amount format.
- `formatSeniority(locale, key)` and `SENIORITY_ORDER` for seniority display.

The structured-data families are `Occupation`,
`MonetaryAmountDistribution`, `ItemList`, and `FAQPage`. Feed them the SDK
salary read model; preserve nullable aggregates and server-computed values.

This branch is complete when every applicable schema object has the expected
schema.org type, null aggregates produce no fabricated figure, the board
language comes from context, and every displayed value traces to a response
field.
