/**
 * `@cavuno/board/format` — board-language display formatting.
 *
 * Every label-producing helper takes the board language
 * (`board.context().language`) as a REQUIRED leading parameter — no `en`
 * default, so a German-native board can never silently render English.
 * Transcribed from the hosted board's formatters and tested against
 * them ; the two implementations cannot drift silently.
 */

export {
  formatDate,
  formatMonthYear,
  formatPublishedRelativeDate,
} from './dates';
export { fullJobToCard } from './job-card';
export { fieldLabel } from './labels';
export { cardLocationLabel, locationLabel } from './location';
export { getSalaryLexicon } from './salary-lexicon';
export type {
  SalaryFrames,
  SalaryLexicon,
  SalaryTimeframeValue,
  SeniorityKey,
} from './salary-lexicon';
export { formatSalaryRange } from './salary-range';
export type {
  SalaryTimeframeInput,
  SalaryTimeframeOverrides,
} from './salary-range';
/**
 * USD-only hosted salary-statistics formatters (seo `formatUsd` /
 * `formatRange`), re-exported under explicit aliases for client view-model
 * mappers. Distinct from `formatSalaryRange` above — that helper is the
 * board-language, currency-aware job-card range formatter. Do not merge or
 * unify the two; each is tested separately. Implementations remain
 * in `src/seo/salary.ts`; this is a pure re-export with rename so consumers
 * can import presentation helpers from `@cavuno/board/format` without the
 * seo entry.
 */
export {
  formatUsd as formatSalaryStatUsd,
  formatRange as formatSalaryStatRange,
} from '../seo/salary';
/** Scheme-less company website normalizer (presentation helper; lives in seo). */
export { normalizeWebsiteUrl } from '../seo/job-posting';
/** Job detail breadcrumb trail for listing UIs (presentation helper; lives in seo). */
export { buildJobBreadcrumbs } from '../seo/breadcrumbs';
export { companyIntro } from './company-intro';
export { COUNTRY_CODES, countryOptions } from './countries';
export type { CountryOption, IsoCountryCode } from './countries';
export { resolveCustomFieldDisplay } from './custom-fields';
export type { CustomFieldDisplayEntry } from './custom-fields';
export { PUBLIC_LABEL_GROUPS, uiCopy } from './ui-copy';
export type {
  AlertsCopy,
  ApplyCopy,
  BlogCopy,
  BoardLabelOverrides,
  BreadcrumbsCopy,
  CopyLinkCopy,
  EntityCopy,
  FooterCopy,
  JobCardCopy,
  JobDetailCopy,
  JobSearchCopy,
  NavCopy,
  PaginationCopy,
  SalaryCopy,
  UiCopy,
} from './ui-copy';
