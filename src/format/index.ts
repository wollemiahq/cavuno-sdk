/**
 * `@cavuno/board/format` — board-language display formatting.
 *
 * Every label-producing helper takes the board language
 * (`board.context().language`) as a REQUIRED leading parameter — no `en`
 * default, so a German-native board can never silently render English.
 * Transcribed from the hosted board's formatters and tested against
 * them ; the two implementations cannot drift silently.
 *
 *chrome copy (hand-written display words) is application-owned.
 * This entry keeps contract/data-shaping formatters and `Intl`-backed
 * amount/unit formatting only.
 */

export {
  formatDate,
  formatMonthYear,
  formatPublishedRelativeDate,
} from './dates';
export { formatSalaryRange } from './salary-range';
export type {
  CurrencyDisplay,
  FormattedSalaryRange,
  NumberNotation,
  SalaryTimeframeInput,
  SalaryTimeframeValue,
} from './salary-range';
/**
 * Compact salary-statistics formatters (seo `formatSalaryStat` /
 * `formatSalaryStatRange`), re-exported so client view-model mappers can
 * import presentation helpers from `@cavuno/board/format` without the seo
 * entry. Distinct from `formatSalaryRange` above — that helper is the
 * job-card range formatter (amount + separate timeframe field). Do not
 * merge or unify the two; each is tested separately. Implementations
 * remain in `src/seo/salary.ts`.
 */
export {
  formatSalaryStat,
  formatSalaryStatRange,
} from '../seo/salary';
/** Scheme-less company website normalizer (presentation helper; lives in seo). */
export { normalizeWebsiteUrl } from '../seo/job-posting';
/** Job detail breadcrumb trail for listing UIs (presentation helper; lives in seo). */
export { buildJobBreadcrumbs } from '../seo/breadcrumbs';
export type { JobBreadcrumb } from '../seo/breadcrumbs';
export { COUNTRY_CODES, countryOptions } from './countries';
export type { CountryOption, IsoCountryCode } from './countries';
export { resolveCustomFieldDisplay } from './custom-fields';
export type { CustomFieldDisplayEntry } from './custom-fields';
