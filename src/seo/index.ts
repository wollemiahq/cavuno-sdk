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
 * Rule: the SDK formats with `Intl` and returns structure; it never picks
 * words. Callers supply title/description copy for `listingHead`, map
 * `buildSalaryFaq` entry kinds to localized FAQ prose, compose per-seniority
 * distribution names via `seniorityName({ seniority, entity })`, and own
 * any chrome around JSON-LD data labels.
 */

export { createAuthorProfileJsonLd, createBlogArticleJsonLd } from './blog';
export type { ArticleJsonLdPost } from './blog';
export { buildJobBreadcrumbs, createBreadcrumbJsonLd } from './breadcrumbs';
export type { BreadcrumbItemInput, JobBreadcrumb } from './breadcrumbs';
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
  formatSalaryStat,
  formatSalaryStatRange,
  itemListJsonLd,
  locationSalaryJsonLd,
  SENIORITY_ORDER,
  skillSalaryJsonLd,
  sortBySeniority,
  titleSalaryJsonLd,
} from './salary';
export type {
  FaqItem,
  NumberNotation,
  SalaryFaqEntry,
  SalaryJsonLdOptions,
  SalaryOccupationListOptions,
} from './salary';
