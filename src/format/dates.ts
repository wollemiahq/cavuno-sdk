/**
 * Date display helpers in the board language (required leading parameter,
 * ) — transcribed from the hosted board's `date-labels.ts` and
 * tested against the hosted behavior.
 *
 * Job cards and the job-detail header render the RELATIVE form
 * (`formatPublishedRelativeDate` — "5 days ago"); the absolute medium date
 * (`formatDate`) is what hosted uses for blog metadata and detail facts.
 *
 * Invalid locales return `null` rather than English unit abbreviations
 * (`5d` / `5mo`) or a sign-stripped digit string. Past vs future is kept
 * (negative → past) so RTF can own the word.
 */

import { normalizeLocale } from './locale';

const rtfShortCache = new Map<string, Intl.RelativeTimeFormat>();
/** `numeric: 'auto'` so `format(0, 'second')` yields "now" / "jetzt" / … */
const rtfNowCache = new Map<string, Intl.RelativeTimeFormat>();
const dtfCache = new Map<string, Intl.DateTimeFormat>();
const monthYearCache = new Map<string, Intl.DateTimeFormat>();

/**
 * CLDR `short` width — not `narrow`. English `narrow` happens to read as
 * prose (`5d ago`), but `fr`/`ru`/`ro` narrow degrades to a signed number
 * (`-5 j`), and `he` can emit parenthesised digits. `short` fixes those
 * without changing en/de/ja/ar readability.
 */
function getShortRelativeTimeFormat(language: string) {
  let rtf = rtfShortCache.get(language);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(language, {
      numeric: 'always',
      style: 'short',
    });
    rtfShortCache.set(language, rtf);
  }
  return rtf;
}

function getNowRelativeTimeFormat(language: string) {
  let rtf = rtfNowCache.get(language);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(language, {
      numeric: 'auto',
      style: 'short',
    });
    rtfNowCache.set(language, rtf);
  }
  return rtf;
}

function getDateTimeFormat(language: string) {
  let dtf = dtfCache.get(language);
  if (!dtf) {
    // timeZone pinned to UTC — matches hosted, so a date never shifts by a
    // calendar day depending on where the code executes.
    dtf = new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
    dtfCache.set(language, dtf);
  }
  return dtf;
}

function getMonthYearFormat(language: string) {
  let dtf = monthYearCache.get(language);
  if (!dtf) {
    // Same UTC pin as formatDate — full ISO timestamps must not render a
    // different calendar month under America/Los_Angeles vs UTC.
    dtf = new Intl.DateTimeFormat(language, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    monthYearCache.set(language, dtf);
  }
  return dtf;
}

/**
 * Short relative unit via `Intl`. When construction/format throws (invalid
 * locale), returns `null` rather than English abbreviations (`d`/`mo`/`w`)
 * or a sign-stripped digit string — callers already treat null as "no label".
 * `value` keeps its sign (past negative, future positive).
 */
function formatShort(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: string,
): string | null {
  try {
    return getShortRelativeTimeFormat(language).format(value, unit);
  } catch {
    return null;
  }
}

/**
 * Absolute medium date in the board language, UTC-pinned — e.g.
 * "Jun 24, 2026" (`en`) / "24.06.2026"-style per locale. What hosted uses
 * for blog metadata and detail facts; job CARDS use the relative form.
 * Returns `null` for missing/unparseable input.
 */
export function formatDate(
  locale: string,
  value: string | number | null,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const normalized = normalizeLocale(locale);
  if (!normalized) return null;
  try {
    return getDateTimeFormat(normalized).format(parsed);
  } catch {
    // Machine form only — ISO date, not a localized display string.
    return parsed.toISOString().split('T')[0]!;
  }
}

/**
 * Relative published label — "5 days ago" (en) / "vor 5 Tagen" (de) — the
 * form the hosted board renders on job cards and the job-detail header.
 * Under one minute uses `Intl.RelativeTimeFormat` with `numeric: 'auto'` so
 * the board language owns "now" / "jetzt" / "maintenant". `referenceNowMs`
 * exists for deterministic tests.
 */
export function formatPublishedRelativeDate(
  locale: string,
  value: string | number | null,
  referenceNowMs = Date.now(),
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const normalized = normalizeLocale(locale);
  if (!normalized) return null;

  const diff = referenceNowMs - parsed.getTime();
  const absDiff = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (absDiff < minute) {
    try {
      return getNowRelativeTimeFormat(normalized).format(0, 'second');
    } catch {
      return formatShort(0, 'second', normalized);
    }
  }

  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'year', ms: year },
    { unit: 'month', ms: month },
    { unit: 'week', ms: week },
    { unit: 'day', ms: day },
    { unit: 'hour', ms: hour },
    { unit: 'minute', ms: minute },
  ];

  for (const candidate of units) {
    if (absDiff >= candidate.ms) {
      const valueInUnit = Math.round(absDiff / candidate.ms);
      // Keep the sign: past → negative, future → positive (RTF owns the word).
      const direction = diff >= 0 ? -valueInUnit : valueInUnit;
      return formatShort(direction, candidate.unit, normalized);
    }
  }

  const seconds = Math.round(absDiff / 1000);
  const direction = diff >= 0 ? -seconds : seconds;
  return formatShort(direction, 'second', normalized);
}

/**
 * Month-year label, e.g. "Jun 2023" — transcribed from the hosted board's
 * `formatMonthYear`.
 *
 * - Date-only inputs (`YYYY-MM`, `YYYY-MM-DD`) get a UTC midnight pin
 *   (`T00:00:00.000Z`) so the UTC formatter below keeps the same calendar
 *   month. Local midnight + `timeZone: 'UTC'` would shift western zones
 *   back a day (e.g. Jun 1 AEST → May 31 UTC).
 * - Full ISO timestamps are formatted with `timeZone: 'UTC'` (same pin as
 *   `formatDate`) so a UTC midnight never renders as the previous month
 *   under America/Los_Angeles.
 * - Missing or unparseable input returns `null`, matching `formatDate` —
 *   never the English literal `"Invalid Date"`.
 */
export function formatMonthYear(
  locale: string,
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) return null;

  // Date-only calendar forms — pin UTC midnight so the UTC formatter below
  // keeps the same calendar month (local midnight + timeZone:'UTC' would
  // shift western zones back a day, e.g. Jun 1 AEST → May 31 UTC).
  const isDateOnly = /^\d{4}-\d{2}(-\d{2})?$/.test(dateStr);
  const parsed = isDateOnly
    ? new Date(
        dateStr.length === 7
          ? `${dateStr}-01T00:00:00.000Z`
          : `${dateStr}T00:00:00.000Z`,
      )
    : new Date(dateStr);

  if (Number.isNaN(parsed.getTime())) return null;

  const normalized = normalizeLocale(locale);
  if (!normalized) return null;

  try {
    return getMonthYearFormat(normalized).format(parsed);
  } catch {
    return null;
  }
}
