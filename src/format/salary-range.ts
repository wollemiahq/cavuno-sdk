import { getSalaryLexicon } from './salary-lexicon';

import type { SalaryTimeframeValue } from './salary-lexicon';

/**
 * Board-language salary-range formatting, transcribed from the hosted board's
 * `format-salary-range.ts` and tested against it
 * `en` boards keep the legacy manual symbol-before form
 * (byte-identical to hosted); non-`en` boards get locale-correct currency
 * placement via `Intl` `style:'currency'`.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  RUB: '₽',
  BRL: 'R$',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF ',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  PLN: 'zł ',
  MXN: 'MX$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  ZAR: 'R ',
  THB: '฿',
  PHP: '₱',
  IDR: 'Rp ',
  MYR: 'RM ',
  VND: '₫',
  AED: 'AED ',
  SAR: 'SAR ',
  ILS: '₪',
  TRY: '₺',
  CZK: 'Kč ',
  HUF: 'Ft ',
  RON: 'lei ',
  BGN: 'лв ',
  HRK: 'kn ',
  ISK: 'kr ',
  CLP: 'CLP$',
  COP: 'COP$',
  PEN: 'S/',
  ARS: 'ARS$',
  TWD: 'NT$',
  NGN: '₦',
  EGP: 'E£',
  PKR: '₨',
  BDT: '৳',
  UAH: '₴',
  KZT: '₸',
};

function getCurrencySymbol(currency: string | null | undefined): string {
  if (!currency) {
    return '$';
  }

  const normalized = currency.trim().toUpperCase();

  return CURRENCY_SYMBOLS[normalized] ?? `${normalized} `;
}

const compactFormatCache = new Map<string, Intl.NumberFormat>();

function getCompactFormatter(language: string): Intl.NumberFormat {
  const cached = compactFormatCache.get(language);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(language, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  });
  compactFormatCache.set(language, formatter);
  return formatter;
}

function formatCompactNumber(
  value: number,
  language: string | undefined,
): string {
  try {
    return getCompactFormatter(language ?? 'en').format(value);
  } catch {
    // Fallback for invalid locale
    if (value >= 1000000) {
      const millions = value / 1000000;
      return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    }
    if (value >= 1000) {
      const thousands = value / 1000;
      return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(1)}k`;
    }
    return value.toString();
  }
}

const compactCurrencyCache = new Map<string, Intl.NumberFormat | null>();

/**
 * Locale-correct compact currency for NON-`en` boards: the symbol sits per
 * locale via `Intl` `style:'currency'` (e.g. "80.000 €" — symbol after the
 * number). `en` boards never reach here — they keep the legacy manual
 * symbol-before form, byte-identical. Falls back to the manual symbol-before
 * form on an invalid currency code.
 */
function formatCompactCurrency(
  value: number,
  language: string,
  currency: string | null | undefined,
): string {
  const currencyCode = (currency ?? 'USD').trim().toUpperCase();
  const cacheKey = `${language}:${currencyCode}`;

  let formatter = compactCurrencyCache.get(cacheKey);

  if (formatter === undefined) {
    try {
      formatter = new Intl.NumberFormat(language, {
        style: 'currency',
        currency: currencyCode,
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1,
      });
    } catch {
      formatter = null;
    }
    compactCurrencyCache.set(cacheKey, formatter);
  }

  if (!formatter) {
    return `${getCurrencySymbol(currency)}${formatCompactNumber(value, language)}`;
  }

  return formatter.format(value);
}

export type SalaryTimeframeInput =
  | SalaryTimeframeValue
  | string
  | null
  | undefined;

function appendTimeframe(
  value: string | null,
  timeframeLabel: string | null,
): string | null {
  if (!value) {
    return null;
  }

  if (!timeframeLabel) {
    return value;
  }

  return `${value} ${timeframeLabel}`;
}

/** Owner-customized timeframe words (board settings) — from the board's SEO/labels config. */
export interface SalaryTimeframeOverrides {
  yearlyLabel?: string;
  monthlyLabel?: string;
  weeklyLabel?: string;
  dailyLabel?: string;
  hourlyLabel?: string;
}

/**
 * Format a per-job salary range in the BOARD language
 * (`board.context().language` — required, never defaulted; see ).
 * The fixed words (timeframe, "From"/"Up to") come from
 * `getSalaryLexicon(language)` with precedence owner-override > lexicon >
 * English source. Currency placement is gated: `en` keeps the legacy manual
 * symbol-before form (byte-identical to the hosted board); non-`en` uses
 * `Intl` `style:'currency'` so the symbol sits per locale.
 *
 * @example
 * formatSalaryRange('en', 90000, 120000, 'per_year', 'USD');
 * // "$90K – $120K Yearly"
 * formatSalaryRange('de', 90000, null, 'per_year', 'EUR');
 * // "ab 90.000 € pro Jahr"
 */
export function formatSalaryRange(
  language: string | undefined,
  min: number | null,
  max: number | null,
  timeframe: SalaryTimeframeInput,
  currency: string | null = null,
  timeframeOverrides?: SalaryTimeframeOverrides,
): string | null {
  if (min == null && max == null) {
    return null;
  }

  const locale = language ?? 'en';
  const lexicon = getSalaryLexicon(locale);

  // Timeframe label precedence: owner-CUSTOMIZED override > lexicon[locale] >
  // none (unknown timeframe → null). An override equal to the English SOURCE
  // word is the unchanged board-settings default — NOT a real customization —
  // so it falls through to the board-language lexicon. On an en board this is
  // a no-op (lexicon en == the dropped default), so en stays byte-identical.
  const overrideMap: Record<string, string | undefined> = {
    per_year: timeframeOverrides?.yearlyLabel,
    per_month: timeframeOverrides?.monthlyLabel,
    per_week: timeframeOverrides?.weeklyLabel,
    per_day: timeframeOverrides?.dailyLabel,
    per_hour: timeframeOverrides?.hourlyLabel,
  };
  const rawOverride = timeframe ? overrideMap[timeframe] : undefined;
  const enSourceWord = timeframe
    ? (getSalaryLexicon('en').timeframe as Record<string, string>)[timeframe]
    : undefined;
  const lexiconTimeframe = timeframe
    ? ((lexicon.timeframe as Record<string, string>)[timeframe] ?? null)
    : null;
  const timeframeLabel =
    rawOverride && rawOverride !== enSourceWord
      ? rawOverride
      : lexiconTimeframe;

  // `en` keeps the manual symbol-before form (byte-identical); non-`en`
  // formats the amount with locale-correct currency placement.
  const formatAmount =
    locale === 'en'
      ? (value: number) =>
          `${getCurrencySymbol(currency)}${formatCompactNumber(value, locale)}`
      : (value: number) => formatCompactCurrency(value, locale, currency);

  if (min != null && max != null) {
    return appendTimeframe(
      `${formatAmount(min)} – ${formatAmount(max)}`,
      timeframeLabel,
    );
  }

  if (min != null) {
    return appendTimeframe(
      `${lexicon.rangePrefix.from} ${formatAmount(min)}`,
      timeframeLabel,
    );
  }

  return appendTimeframe(
    `${lexicon.rangePrefix.upTo} ${formatAmount(max as number)}`,
    timeframeLabel,
  );
}
