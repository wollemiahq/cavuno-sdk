/**
 * Date display helpers in the board language (required leading parameter,
 * ) — transcribed from the hosted board's `date-labels.ts` and
 * tested against the hosted behavior.
 *
 * Job cards and the job-detail header render the RELATIVE form
 * (`formatPublishedRelativeDate` — "5d ago"); the absolute medium date
 * (`formatDate`) is what hosted uses for blog metadata and detail facts.
 */

const rtfNarrowCache = new Map<string, Intl.RelativeTimeFormat>();
const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getNarrowRelativeTimeFormat(language: string | undefined) {
  const key = language ?? 'en';
  let rtf = rtfNarrowCache.get(key);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(key, {
      numeric: 'always',
      style: 'narrow',
    });
    rtfNarrowCache.set(key, rtf);
  }
  return rtf;
}

function getDateTimeFormat(language: string | undefined) {
  const key = language ?? 'en';
  let dtf = dtfCache.get(key);
  if (!dtf) {
    // timeZone pinned to UTC — matches hosted, so a date never shifts by a
    // calendar day depending on where the code executes.
    dtf = new Intl.DateTimeFormat(key, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
    dtfCache.set(key, dtf);
  }
  return dtf;
}

function formatNarrow(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: string | undefined,
): string {
  try {
    return getNarrowRelativeTimeFormat(language).format(value, unit);
  } catch {
    // Fallback to hardcoded abbreviations
    const shortMap: Record<string, string> = {
      year: 'y',
      month: 'mo',
      week: 'w',
      day: 'd',
      hour: 'h',
      minute: 'm',
      second: 's',
    };
    return `${Math.abs(value)}${shortMap[unit] ?? unit}`;
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
  try {
    return getDateTimeFormat(locale).format(parsed);
  } catch {
    return parsed.toISOString().split('T')[0]!;
  }
}

/**
 * Relative published label — "5d ago" (en) / "vor 5 T." (de) — the form the
 * hosted board renders on job cards and the job-detail header. Under one
 * minute renders "now". `referenceNowMs` exists for deterministic tests.
 */
export function formatPublishedRelativeDate(
  locale: string,
  value: string | number | null,
  referenceNowMs = Date.now(),
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const diff = referenceNowMs - parsed.getTime();
  const absDiff = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (absDiff < minute) {
    return 'now';
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
      const direction = diff >= 0 ? -valueInUnit : valueInUnit;
      return formatNarrow(direction, candidate.unit, locale);
    }
  }

  const seconds = Math.round(absDiff / 1000);
  const direction = diff >= 0 ? -seconds : seconds;
  return formatNarrow(direction, 'second', locale);
}

/**
 * Month-year label, e.g. "Jun 2023" — transcribed from the hosted board's
 * `formatMonthYear`. The `T00:00:00` suffix
 * prevents timezone-related off-by-one-month issues on date-only strings.
 */
export function formatMonthYear(locale: string, dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');

  return date.toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}
