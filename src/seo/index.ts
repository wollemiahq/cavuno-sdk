/**
 * `@cavuno/board/seo` — structured data + head builders.
 *
 * Everything a board frontend needs to be SEO-correct without reinventing
 * the platform's rules: Google for Jobs `JobPosting` JSON-LD (including the
 * 249-country worldwide-remote enumeration), salary-page `Occupation`/
 * `MonetaryAmountDistribution`/`ItemList`/`FAQPage` builders, blog
 * `Article`/`ProfilePage`, `BreadcrumbList`, and framework-neutral listing
 * `<head>` descriptors.
 *
 * Transcribed from the hosted board's builders and tested against
 * them  — the two implementations cannot drift silently.
 * JSON-LD structure is locale-neutral per schema.org; only helpers that
 * produce display strings (the salary formatters/FAQ and the seniority
 * labels embedded in salary distribution names) take the board language,
 * as a REQUIRED leading parameter (`board.context().language` — no `en`
 * default).
 */

export { createAuthorProfileJsonLd, createBlogArticleJsonLd } from './blog';
export type { ArticleJsonLdPost } from './blog';
export { buildJobBreadcrumbs, createBreadcrumbJsonLd } from './breadcrumbs';
export type { BreadcrumbItemInput } from './breadcrumbs';
export {
  ALL_COUNTRY_CODES,
  createJobPostingJsonLd,
  normalizeWebsiteUrl,
} from './job-posting';
export type { JsonLdBoard, JsonLdObject } from './job-posting';
export { listingHead, listingJsonLd } from './listing';
export type { ListingHeadOptions } from './listing';
export {
  buildSalaryFaq,
  companyCategorySalaryJsonLd,
  companySalaryJsonLd,
  crossAxisSalaryJsonLd,
  faqJsonLd,
  formatRange,
  formatSeniority,
  formatUsd,
  itemListJsonLd,
  locationSalaryJsonLd,
  SENIORITY_ORDER,
  skillSalaryJsonLd,
  sortBySeniority,
  titleSalaryJsonLd,
} from './salary';
export type { FaqItem } from './salary';
