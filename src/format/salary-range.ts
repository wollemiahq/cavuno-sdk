/**
 * Wire enum for `salaryTimeframe`. Defined here (not re-exported from any
 * private  catalog) so the published `@cavuno/board/format` types
 * stay self-contained.
 */
export type SalaryTimeframeValue =
  | 'per_year'
  | 'per_month'
  | 'per_week'
  | 'per_day'
  | 'per_hour';

/**
 * Board-language salary-range formatting, transcribed from the hosted board's
 * `format-salary-range.ts` and tested against it
 *.
 *
 * Division of labour:
 * - `Intl` owns the whole amount rendering: number, currency glyph, placement,
 *   spacing, and range joining (`formatRange`). `currencyDisplay:'symbol'`
 *   is deliberate — it is the UNAMBIGUOUS form (CAD → `CA$`, CNY → `CN¥`),
 *   where `narrowSymbol` collapses USD/CAD/AUD/MXN/SGD/HKD/NZD/CLP all to a
 *   bare `$`. A board lists many currencies side by side, so ambiguity is
 *   the failure that matters; ICU falling back to an ISO code (`RUB 90K`) is
 *   the documented preference in that situation, not a defect. See TC39
 *   proposal-intl-currency-display-choices for why no third mode exists yet.
 *   There is NO curated glyph map: a hand-written one drifts, cannot cover
 *   every locale, and its spacing has to be re-derived per locale.
 * - The timeframe comes back as the WIRE ENUM (`per_year`), never a word.
 *   `per_year` renders as "year", "Yearly", "/yr", "per annum", "pro Jahr",
 *   "年収" — `Intl` produces exactly one of those, so producing it here
 *   would pick for the application. The SDK also does not join it: that join
 *   is application-owned. Compose with bidi isolates when operands may
 *   differ in direction — wrap each foreign-direction operand in
 *   U+2066 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE (or the
 *   HTML equivalent `dir="auto"` / `<bdi>`). Example:
 *   `` `${FSI}${amount}${PDI} ${FSI}${label}${PDI}` ``. Never paste a bare
 *   `` `${amount} ${label}` `` template into RTL chrome without isolation.
 * - Open-range chrome words ("From" / "Up to") are application-owned:
 *   this helper returns a `bound` discriminant so apps can name them.
 * - Missing currency is not USD. Returns `null` rather than an unadorned
 *   number; `job-posting` already omits `baseSalary` for the same case.
 * - Invalid / unsupported locales return `null` rather than English
 *   `M`/`k` / `$` or the host default.
 */

import { normalizeLocale } from './locale';

const currencyCache = new Map<string, Intl.NumberFormat | null>();

/**
 * Locale-correct amount with currency. Returns `null` when `Intl`
 * rejects the locale or currency — never English `M`/`k` and never a bare `$`.
 *
 * Fraction digits: under `notation: 'compact'` we cap at one fractional digit
 * so `$90K` stays readable (compact magnitude is the point). Under
 * `notation: 'standard'` we leave minor units to the currency's CLDR data
 * (USD → 2, KWD/BHD → 3, JPY → 0) — never override them globally.
 */
function formatAmount(
  value: number,
  language: string,
  currencyCode: string,
  currencyDisplay: CurrencyDisplay = 'symbol',
  notation: NumberNotation = 'compact',
): string | null {
  const cacheKey = `${language}:${currencyCode}:${currencyDisplay}:${notation}`;
  let formatter = currencyCache.get(cacheKey);

  if (formatter === undefined) {
    try {
      const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay,
        notation,
      };
      if (notation === 'compact') {
        // Digit cap only while compacting — not a global minor-unit override.
        options.compactDisplay = 'short';
        options.maximumFractionDigits = 1;
        options.minimumFractionDigits = 0;
      }
      formatter = new Intl.NumberFormat(language, options);
    } catch {
      formatter = null;
    }
    currencyCache.set(cacheKey, formatter);
  }

  return formatter ? formatter.format(value) : null;
}

/**
 * Range of two amounts via `Intl.NumberFormat.prototype.formatRange` so the
 * locale owns separator, whether the currency/magnitude is repeated, and
 * bidi marks (ja `～`, de tight en-dash, ar RTL-safe join).
 * Returns `null` when `Intl` rejects the inputs.
 */
function formatRange(
  min: number,
  max: number,
  language: string,
  currencyCode: string,
  currencyDisplay: CurrencyDisplay = 'symbol',
  notation: NumberNotation = 'compact',
): string | null {
  const cacheKey = `${language}:${currencyCode}:${currencyDisplay}:${notation}:range`;
  let formatter = currencyCache.get(cacheKey);

  if (formatter === undefined) {
    try {
      const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay,
        notation,
      };
      if (notation === 'compact') {
        // Digit cap only while compacting — see formatAmount.
        options.compactDisplay = 'short';
        options.maximumFractionDigits = 1;
        options.minimumFractionDigits = 0;
      }
      formatter = new Intl.NumberFormat(language, options);
    } catch {
      formatter = null;
    }
    currencyCache.set(cacheKey, formatter);
  }

  if (!formatter) return null;
  return formatter.formatRange(min, max);
}

const SALARY_TIMEFRAMES: ReadonlySet<SalaryTimeframeValue> = new Set([
  'per_year',
  'per_month',
  'per_week',
  'per_day',
  'per_hour',
]);

export type SalaryTimeframeInput =
  | SalaryTimeframeValue
  | string
  | null
  | undefined;

/**
 * Which ICU currency form to render.
 *
 * `'symbol'` (default) is the UNAMBIGUOUS form — `CA$`, `A$`, `CN¥` — and is
 * the right default for a board listing several currencies side by side.
 * `'narrowSymbol'` is the short form (`$`, `¥`); on a single-currency board
 * there is nothing to confuse it with, and it reads cleaner. A caller-supplied
 * presentation preference, passed straight to `Intl` — not a word.
 */
export type CurrencyDisplay = 'symbol' | 'narrowSymbol';

/**
 * Number notation preference, passed straight to `Intl.NumberFormat`.
 *
 * When omitted, magnitude picks: `'compact'` only where ICU actually
 * shortens (absolute value ≥ 1000 → `$90K`); smaller values stay
 * `'standard'` so hourly/day rates keep CLDR minor units (`$22.50`,
 * `KWD 22.567`). Compact on a two-figure rate is meaningless and drops
 * cents. Caller override always wins.
 */
export type NumberNotation = 'compact' | 'standard';

/**
 * Compact only where it shortens. ICU's en compact form starts at 1000
 * (`$1K`); below that compact and standard differ mainly in fraction
 * digits (and compact loses cents). Magnitude is a property of the
 * number — not timeframe presentation — so this stays on the right side
 * of .
 *
 * Notation is chosen once for the whole call (`formatRange` needs a
 * single `NumberFormat`). If *any* finite operand is ≥ 1000, the range
 * is compact — so a mixed-magnitude pair like `900` / `1200` renders
 * `¥900 – ¥1.2K`, not mixed standard+compact formatters. Prefer that
 * shared compact form over abandoning locale range joining.
 */
function notationForMagnitude(
  ...values: Array<number | null | undefined>
): NumberNotation {
  let anyFinite = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    anyFinite = true;
    if (Math.abs(v) >= 1000) return 'compact';
  }
  // No finite values → compact is a harmless default (callers already
  // null-out empty ranges before formatting).
  return anyFinite ? 'standard' : 'compact';
}

/**
 * Formatted salary amount + which open/closed bound it represents.
 * Applications own:
 * - chrome words for `from` / `upTo` (e.g. "From", "ab")
 * - joining `text` with `timeframe` (order, spacing, `/`, particles)
 * - bidi isolation around each operand when directions may differ
 *   (U+2066/U+2069 FSI/PDI, or HTML `<bdi>` / `dir="auto"`)
 */
export type FormattedSalaryRange = {
  /** Intl-formatted amount (or range). No timeframe attached. */
  text: string;
  /**
   * The wire timeframe enum, passed straight back — NOT a word.
   *
   * Every rendering of it is presentation: "year", "Yearly", "/yr",
   * "per annum", "pro Jahr", "年収". `Intl` can produce exactly one of
   * those forms, so producing it here would pick for the application.
   * The app maps the enum through its own catalog, the same way it maps
   * `bound` and breadcrumb `kind`.
   *
   * `null` when the wire value is absent or not a known timeframe.
   */
  timeframe: SalaryTimeframeValue | null;
  bound: 'range' | 'from' | 'upTo';
};

/**
 * Format a per-job salary range in the BOARD language
 * (`board.context().language` — required, never defaulted; see ).
 *
 * Returns `{ text, timeframe, bound }` so applications can:
 * - attach open-range chrome in their own locale (`bound`)
 * - compose amount + timeframe order themselves (prefix vs postfix, with or
 *   without `/`, with or without a space — ja/zh often glue with no space)
 * - isolate bidi when composing (see module JSDoc)
 *
 * Returns `null` when both bounds are null, currency is missing/empty, the
 * locale is invalid/unsupported, or `Intl` rejects the currency format.
 *
 * @example
 * formatSalaryRange('en', 90000, 120000, 'per_year', 'USD');
 * // { text: "$90–120K", timeframe: "per_year", bound: "range" }
 * formatSalaryRange('en', 90000, null, 'per_year', 'USD');
 * // { text: "$90K", timeframe: "per_year", bound: "from" }
 * formatSalaryRange('de', 90000, 120000, 'per_year', 'EUR');
 * // { text: "90.000–120.000 €", timeframe: "per_year", bound: "range" }
 * formatSalaryRange('de', 90000, 120000, 'per_year', null);
 * // null  // no currency → no salary
 * formatSalaryRange('en', 22.5, null, 'per_hour', 'USD');
 * // { text: "$22.50", timeframe: "per_hour", bound: "from" }  // magnitude → standard
 */
export function formatSalaryRange(
  language: string,
  min: number | null,
  max: number | null,
  timeframe: SalaryTimeframeInput,
  currency: string | null = null,
  currencyDisplay: CurrencyDisplay = 'symbol',
  notation?: NumberNotation,
): FormattedSalaryRange | null {
  // Non-finite numbers (NaN, ±Infinity) are `number` at the type level and
  // slip past `== null`. Route them to null like every other invalid input
  // this release — reachable from `Number(row.salary_min)`.
  const minOk = min == null || Number.isFinite(min);
  const maxOk = max == null || Number.isFinite(max);
  if (!minOk || !maxOk) {
    return null;
  }
  if (min == null && max == null) {
    return null;
  }

  // No currency means no salary. An unadorned "90.000 – 120.000" tells a job
  // seeker nothing and reads as whatever currency they assume, so it is worse
  // than omitting the figure. `createBaseSalary` (seo/job-posting.ts:178)
  // already made this call for the JSON-LD; returning a string here made the
  // same job assert a salary on the card while omitting `baseSalary` from its
  // structured data.
  const currencyCode = currency?.trim().toUpperCase() || null;
  if (!currencyCode) {
    return null;
  }

  const locale = normalizeLocale(language);
  if (!locale) {
    return null;
  }

  const resolvedNotation =
    notation ?? notationForMagnitude(min, max);

  // `.has` on a Set — not `in` on an object — so prototype keys
  // ('__proto__', 'toString') cannot pass the guard.
  const timeframeLabel =
    typeof timeframe === 'string' &&
    (SALARY_TIMEFRAMES as ReadonlySet<string>).has(timeframe)
      ? (timeframe as SalaryTimeframeValue)
      : null;

  if (min != null && max != null) {
    // Fixed salary (min === max): single amount. ICU formatRange(X, X)
    // emits approximatelySign (`~$140K`) for a degenerate range — wrong
    // when both ends of a posted salary are the same number.
    //
    // Inverted bounds (min > max): swap rather than null. ICU formatRange
    // happily emits `$120–90K`, which reads backwards. Transposed columns
    // in a board feed still carry a real salary — showing a usable ordered
    // range is better for job seekers than dropping the figure. Callers
    // that need strict validation should compare min/max before calling.
    const low = min <= max ? min : max;
    const high = min <= max ? max : min;
    const text =
      low === high
        ? formatAmount(
            low,
            locale,
            currencyCode,
            currencyDisplay,
            resolvedNotation,
          )
        : formatRange(
            low,
            high,
            locale,
            currencyCode,
            currencyDisplay,
            resolvedNotation,
          );
    return text ? { text, timeframe: timeframeLabel, bound: 'range' } : null;
  }

  // Open ranges: amount only. Open-range chrome words, timeframe placement,
  // and their position relative to the amount are application-owned.
  // The `bound` discriminant names which chrome word to attach.
  if (min != null) {
    const text = formatAmount(
      min,
      locale,
      currencyCode,
      currencyDisplay,
      resolvedNotation,
    );
    return text ? { text, timeframe: timeframeLabel, bound: 'from' } : null;
  }

  const text = formatAmount(
    max as number,
    locale,
    currencyCode,
    currencyDisplay,
    resolvedNotation,
  );
  return text ? { text, timeframe: timeframeLabel, bound: 'upTo' } : null;
}
