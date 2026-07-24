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
