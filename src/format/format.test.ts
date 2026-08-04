import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatMonthYear,
  formatPublishedRelativeDate,
} from './dates';
import { formatSalaryRange } from './salary-range';
import { normalizeLocale } from './locale';

// Contract/data-shaping formatters on `@cavuno/board/format`. Timeframe unit
// words come from Intl as a separate field; open-range chrome words and the
// amount↔timeframe join are application-owned. Ranges join via Intl.formatRange.

describe('normalizeLocale', () => {
  it('accepts real negotiated tags and normalizes underscores', () => {
    expect(normalizeLocale('de-AT')).toBe('de-AT');
    expect(normalizeLocale('fr-CA')).toBe('fr-CA');
    expect(normalizeLocale('sr-Latn-RS')).toBe('sr-Latn-RS');
    expect(normalizeLocale('nn')).toBe('nn');
    expect(normalizeLocale('ja-JP-u-ca-japanese')).toBe('ja-JP-u-ca-japanese');
    expect(normalizeLocale('ja_JP')).toBe('ja-JP');
  });

  it('rejects well-formed but unsupported tags (no host-default fallback)', () => {
    // getCanonicalLocales accepts these; supportedLocalesOf returns [].
    expect(normalizeLocale('xx')).toBeNull();
    expect(normalizeLocale('qqq')).toBeNull();
    expect(normalizeLocale('und')).toBeNull();
    expect(normalizeLocale('POSIX')).toBeNull();
    expect(normalizeLocale('klingon')).toBeNull();
    expect(normalizeLocale('art-lojban')).toBeNull();
    expect(normalizeLocale('xx-BAD-!!')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale('   ')).toBeNull();
  });
});

describe('formatSalaryRange', () => {
  it('en uses Intl currency placement + formatRange; timeframe is separate', () => {
    expect(formatSalaryRange('en', 90000, 120000, 'per_year', 'USD')).toEqual({
      text: '$90–120K',
      timeframe: 'per_year',
      bound: 'range',
    });
    expect(formatSalaryRange('en', 90000, 120000, 'per_year', 'EUR')).toEqual({
      text: '€90–120K',
      timeframe: 'per_year',
      bound: 'range',
    });
  });

  it('open-ended ranges return bound discriminants (no From/Up to chrome)', () => {
    expect(formatSalaryRange('en', 90000, null, 'per_year', 'USD')).toEqual({
      text: '$90K',
      timeframe: 'per_year',
      bound: 'from',
    });
    expect(formatSalaryRange('en', null, 120000, 'per_year', 'USD')).toEqual({
      text: '$120K',
      timeframe: 'per_year',
      bound: 'upTo',
    });
    const deFrom = formatSalaryRange('de', 90000, null, 'per_year', 'EUR');
    expect(deFrom?.bound).toBe('from');
    expect(deFrom?.timeframe).toBe('per_year');
    expect(deFrom?.text).not.toContain('Jahr');
    expect(deFrom?.text).not.toContain('ab ');
    expect(deFrom?.text).not.toContain('From');
  });

  it('de renders the Intl unit word separately and formatRange join', () => {
    const de = formatSalaryRange('de', 90000, 120000, 'per_year', 'EUR');
    expect(de?.bound).toBe('range');
    expect(de?.timeframe).toBe('per_year');
    // formatRange owns the separator — de uses a tight en-dash, not " – ".
    expect(de?.text).toMatch(/90\.000–120\.000/);
    expect(de?.text).toContain('€');
    expect(de?.text.startsWith('€')).toBe(false);
    // SDK does not join amount + timeframe (no English " / ").
    expect(de?.text).not.toContain('/');
  });

  it('returns the wire timeframe enum, never a word or an owner label', () => {
    // `per_year` has many legitimate renderings — "year", "Yearly", "/yr",
    // "per annum", "pro Jahr", "年収". Intl produces exactly one of them, so
    // producing it here would pick for the application. The enum comes back
    // untouched and the app maps it through its own catalog, the same way it
    // maps `bound` and breadcrumb `kind`.
    //
    // This is why `timeframeOverrides` and the English factory sentinels are
    // gone: an operator-edited label is app-side copy keyed off this enum,
    // not something the SDK has to be told about.
    for (const language of ['en', 'de', 'fr', 'ja'] as const) {
      expect(
        formatSalaryRange(language, 90000, 120000, 'per_year', 'EUR')
          ?.timeframe,
      ).toBe('per_year');
    }
    const hourly = formatSalaryRange('de', 22, 30, 'per_hour', 'EUR');
    expect(hourly?.timeframe).toBe('per_hour');
    // No word ever leaks into the amount either.
    expect(hourly?.text).not.toMatch(/Stunde|hour|Jahr|year/i);
  });

  it('unseeded locales get Intl unit words with locale number formatting', () => {
    const fr = formatSalaryRange('fr', 90000, null, 'per_year', 'EUR');
    expect(fr?.bound).toBe('from');
    expect(fr?.timeframe).toBe('per_year');
    expect(fr?.text).not.toContain('From ');
    expect(fr?.text).not.toContain('Yearly');
    expect(fr?.text).not.toContain('/');
  });

  it('returns null with no bounds; omits the timeframe for unknown timeframes', () => {
    expect(formatSalaryRange('en', null, null, 'per_year', 'USD')).toBeNull();
    expect(formatSalaryRange('en', 90000, 120000, 'per_project', 'USD')).toEqual(
      {
        text: '$90–120K',
        timeframe: null,
        bound: 'range',
      },
    );
    expect(formatSalaryRange('en', 90000, 120000, null, 'USD')).toEqual({
      text: '$90–120K',
      timeframe: null,
      bound: 'range',
    });
  });

  it('missing currency means no salary — not USD, and not a bare number', () => {
    // An unadorned "90.000–120.000" reads as whatever currency the visitor
    // assumes, so it is worse than omitting the figure. `createBaseSalary`
    // (seo/job-posting.ts) already omits `baseSalary` without a currency;
    // returning a string here made the same job assert a salary on the card
    // while its structured data said there was none.
    expect(formatSalaryRange('de', 90000, 120000, 'per_year', null)).toBeNull();
    expect(formatSalaryRange('en', 90000, null, 'per_year', null)).toBeNull();
    expect(formatSalaryRange('en', 90000, 120000, 'per_year', '   ')).toBeNull();
    expect(formatSalaryRange('ja', 9_000_000, null, 'per_year', '')).toBeNull();
  });

  it('unknown ISO codes that Intl rejects return null (no bare number, no $)', () => {
    // Prefer null over inventing a currency-less amount when the code is bad.
    expect(
      formatSalaryRange('en', 50000, null, null, 'NOTACURRENCY'),
    ).toBeNull();
  });

  it('invalid or unsupported locale returns null (no English M/k, no host default)', () => {
    expect(
      formatSalaryRange(
        'xx-BAD-!!',
        90000,
        1200000,
        'per_year',
        'EUR',
      ),
    ).toBeNull();
    expect(
      formatSalaryRange('not a locale!', 90000, 120000, 'per_year', 'USD'),
    ).toBeNull();
    // Well-formed but unsupported — must not fall through to host English.
    expect(formatSalaryRange('xx', 90000, 120000, 'per_year', 'USD')).toBeNull();
    expect(formatSalaryRange('qqq', 90000, 120000, 'per_year', 'USD')).toBeNull();
    expect(formatSalaryRange('und', 90000, 120000, 'per_year', 'USD')).toBeNull();
  });

  it('normalizes underscore locale tags so ja_JP is Japanese, not English', () => {
    const ja = formatSalaryRange(
      'ja_JP',
      9_000_000,
      12_000_000,
      'per_year',
      'JPY',
    );
    expect(ja?.text).toBeTruthy();
    expect(ja?.text).not.toMatch(/JPY/);
    expect(ja?.text).not.toMatch(/[Mk]/);
    expect(ja?.timeframe).toBeTruthy();
  });

  it('prototype-polluting timeframe strings do not throw', () => {
    expect(
      formatSalaryRange('en', 90000, 120000, '__proto__', 'USD'),
    ).toEqual({
      text: '$90–120K',
      timeframe: null,
      bound: 'range',
    });
    expect(
      formatSalaryRange('en', 90000, 120000, 'constructor', 'USD'),
    ).toEqual({
      text: '$90–120K',
      timeframe: null,
      bound: 'range',
    });
  });

  it('magnitude defaults small rates to standard (preserves minor units)', () => {
    // |value| < 1000 → standard by default (compact would drop cents).
    const kwd = formatSalaryRange('en', 22.567, 30.123, 'per_hour', 'KWD');
    expect(kwd?.text).toBe('KWD\u00a022.567–30.123');
    expect(kwd?.timeframe).toBe('per_hour');

    const usd = formatSalaryRange('en', 22.5, null, 'per_hour', 'USD');
    expect(usd?.text).toBe('$22.50');

    const bhd = formatSalaryRange('en', 10.5, null, 'per_day', 'BHD');
    expect(bhd?.text).toBe('BHD\u00a010.500');

    // Explicit compact override still wins (and still caps digits).
    const forced = formatSalaryRange(
      'en',
      22.5,
      null,
      'per_hour',
      'USD',
      'symbol',
      'compact',
    );
    expect(forced?.text).toBe('$22.5');
  });

  it('returns null for non-finite bounds (NaN / Infinity)', () => {
    expect(
      formatSalaryRange('en', Number.NaN, 120000, 'per_year', 'USD'),
    ).toBeNull();
    expect(
      formatSalaryRange('en', 90000, Number.NaN, 'per_year', 'USD'),
    ).toBeNull();
    expect(
      formatSalaryRange(
        'en',
        0,
        Number.POSITIVE_INFINITY,
        'per_year',
        'USD',
      ),
    ).toBeNull();
  });

  it('formats identical min/max as a fixed salary (not ICU ~approximate)', () => {
    expect(
      formatSalaryRange('en', 140000, 140000, 'per_year', 'USD'),
    ).toEqual({
      text: '$140K',
      timeframe: 'per_year',
      bound: 'range',
    });
  });

  it('swaps inverted bounds so the range reads low→high', () => {
    // Transposed min/max columns still carry a real salary; dropping the
    // figure (null) would hide pay from job seekers. ICU formatRange does
    // not reorder, so we normalize before formatting.
    expect(
      formatSalaryRange('en', 120000, 90000, 'per_year', 'USD'),
    ).toEqual({
      text: '$90–120K',
      timeframe: 'per_year',
      bound: 'range',
    });
  });

  it('documents mixed-magnitude ranges share one notation (any ≥ 1000 → compact)', () => {
    // formatRange needs a single NumberFormat; notation is chosen once.
    // Compact when any operand is ≥ 1000 yields visually mixed forms like
    // `$900 – $1.2K` — accepted so locale range joining is preserved.
    const mixed = formatSalaryRange('en', 900, 1200, 'per_year', 'USD');
    expect(mixed?.bound).toBe('range');
    expect(mixed?.text).toMatch(/900/);
    expect(mixed?.text).toMatch(/1\.2K|1,200|1200/);
  });

  // There is no curated glyph map — `Intl` owns the whole rendering. These
  // pin the two properties that map existed to guarantee, across the MATRIX
  // rather than a couple of examples: two prior regressions here both shipped
  // green because the test covered only the currencies the fix was written
  // for (RUB/THB/CAD), missing 100 broken language x currency pairs.
  describe('currency rendering', () => {
    const LANGUAGES = [
      'en',
      'de',
      'fr',
      'es',
      'pt',
      'nl',
      'it',
      'sv',
      'da',
      'nb',
      'fi',
      'pl',
      'cs',
      'ru',
      'ja',
      'ko',
      'zh',
      'hi',
      'tr',
      'ar',
    ] as const;
    const CURRENCIES = [
      'USD',
      'EUR',
      'GBP',
      'RUB',
      'THB',
      'NGN',
      'PLN',
      'SEK',
      'NOK',
      'DKK',
      'CAD',
      'AUD',
      'CHF',
      'AED',
      'SAR',
      'BGN',
      'MXN',
      'SGD',
      'HKD',
      'NZD',
      'CLP',
      'COP',
      'PEN',
      'ARS',
      'JPY',
      'CNY',
      'INR',
      'TRY',
      'ZAR',
      'BRL',
    ] as const;

    it('never glues a multi-letter currency token to the digits', () => {
      const glued: string[] = [];
      for (const language of LANGUAGES) {
        for (const currency of CURRENCIES) {
          const text = formatSalaryRange(
            language,
            90000,
            120000,
            'per_year',
            currency,
          )?.text;
          // Two-or-more letters touching a digit on either side.
          // formatRange may use ～ / – / -; split on common range separators.
          const left = text?.split(/[–～\-]/u)[0] ?? '';
          if (text && /\p{L}{2,}\p{Nd}|\p{Nd}\p{L}{2,}/u.test(left)) {
            glued.push(`${language}/${currency}: ${text}`);
          }
        }
      }
      expect(glued).toEqual([]);
    });

    it('keeps dollar-family currencies distinguishable from USD', () => {
      // The failure that matters on a board listing many currencies: a
      // Canadian salary rendering as a bare "$90K". `currencyDisplay:'symbol'`
      // is chosen over `narrowSymbol` precisely because narrowSymbol collapses
      // USD/CAD/AUD/MXN/SGD/HKD/NZD/CLP to the same glyph.
      const usd = formatSalaryRange('en', 90000, null, null, 'USD')?.text;
      for (const currency of [
        'CAD',
        'AUD',
        'NZD',
        'SGD',
        'HKD',
        'MXN',
      ] as const) {
        const text = formatSalaryRange(
          'en',
          90000,
          null,
          null,
          currency,
        )?.text;
        expect(text, `${currency} must not render like USD`).not.toBe(usd);
      }
    });

    it('formatRange locale shapes: ja ~, de tight dash, es hyphen, ar bidi-safe', () => {
      // Literal pins for a handful of locale×currency pairs — enough to
      // catch a changed option (style/notation/fraction digits). Not
      // constructed with the same Intl options as the implementation.
      const ja = formatSalaryRange('ja', 90000, 120000, null, 'EUR')?.text;
      const de = formatSalaryRange('de', 90000, 120000, null, 'EUR')?.text;
      const es = formatSalaryRange('es', 90000, 120000, null, 'EUR')?.text;
      const ar = formatSalaryRange('ar', 90000, 120000, null, 'EUR')?.text;
      const en = formatSalaryRange('en', 90000, 120000, null, 'USD')?.text;

      expect(en).toBe('$90–120K');
      expect(ja).toContain('～');
      expect(ja).not.toContain(' – ');
      expect(ja).toMatch(/€|EUR|ユーロ/);

      expect(de).toMatch(/90\.000–120\.000/);
      expect(de).toContain('€');
      expect(de).not.toContain(' – ');

      expect(es).not.toContain(' – ');
      expect(es).toMatch(/90|120/);

      // Hand-join used to splice an LTR " – " between two RTL-marked runs.
      expect(ar).not.toContain(' – ');
      expect(ar).toMatch(/90|١٢٠|120/);
    });
  });
});

describe('dates', () => {
  it('formatDate renders a UTC-pinned medium date in the board language', () => {
    expect(formatDate('en', '2026-06-24T12:00:00.000Z')).toBe('Jun 24, 2026');
    // UTC pin: 2am UTC must NOT shift back a day in western timezones.
    expect(formatDate('en', '2026-01-01T02:00:00.000Z')).toBe('Jan 1, 2026');
    expect(formatDate('en', null)).toBeNull();
    expect(formatDate('en', 'not-a-date')).toBeNull();
    expect(formatDate('de', '2026-06-24T12:00:00.000Z')).toContain('2026');
  });

  it('formatPublishedRelativeDate renders the card form deterministically', () => {
    const now = Date.parse('2026-07-02T12:00:00.000Z');
    const at = (ms: number) => new Date(now - ms).toISOString();
    expect(formatPublishedRelativeDate('en', at(30 * 1000), now)).toBe('now');
    expect(formatPublishedRelativeDate('de', at(30 * 1000), now)).toBe('jetzt');
    expect(formatPublishedRelativeDate('fr', at(30 * 1000), now)).toBe(
      'maintenant',
    );
    expect(formatPublishedRelativeDate('ja', at(30 * 1000), now)).toBe('今');
    // short (not narrow) — en reads "5 days ago"; fr/ru/ro are prose, not "-5 j".
    expect(
      formatPublishedRelativeDate('en', at(5 * 24 * 3600 * 1000), now),
    ).toBe('5 days ago');
    expect(
      formatPublishedRelativeDate('de', at(5 * 24 * 3600 * 1000), now),
    ).toBe('vor 5 Tagen');
    // fr uses U+00A0 (NBSP) between the number and unit in short style.
    expect(
      formatPublishedRelativeDate('fr', at(5 * 24 * 3600 * 1000), now),
    ).toBe('il y a 5\u00a0j');
    expect(
      formatPublishedRelativeDate('ru', at(5 * 24 * 3600 * 1000), now),
    ).toBe('5 дн. назад');
    expect(
      formatPublishedRelativeDate('ro', at(5 * 24 * 3600 * 1000), now),
    ).toBe('acum 5 zile');
    expect(formatPublishedRelativeDate('en', null, now)).toBeNull();
    // Unsupported locale → null, not host-default English.
    expect(
      formatPublishedRelativeDate('qqq', at(5 * 24 * 3600 * 1000), now),
    ).toBeNull();
  });

  it('keeps past vs future sign and returns null on invalid locale', () => {
    const now = Date.parse('2026-07-02T12:00:00.000Z');
    const past = new Date(now - 5 * 24 * 3600 * 1000).toISOString();
    const future = new Date(now + 5 * 24 * 3600 * 1000).toISOString();
    const pastLabel = formatPublishedRelativeDate('en', past, now);
    const futureLabel = formatPublishedRelativeDate('en', future, now);
    expect(pastLabel).toBe('5 days ago');
    // Future is not the same as past (sign was not stripped via Math.abs alone).
    expect(futureLabel).not.toBe(pastLabel);
    expect(futureLabel).toBe('in 5 days');
    expect(
      formatPublishedRelativeDate('xx-BAD-!!', past, now),
    ).toBeNull();
    // Underscore typo normalizes rather than falling to English abbreviations.
    expect(formatPublishedRelativeDate('ja_JP', past, now)).toBeTruthy();
    expect(formatPublishedRelativeDate('ja_JP', past, now)).not.toBe('5d');
    expect(formatPublishedRelativeDate('ja_JP', past, now)).not.toBe(
      '5 days ago',
    );
  });

  it('formatMonthYear avoids the timezone off-by-one-month trap', () => {
    expect(formatMonthYear('en-US', '2023-06-01')).toBe('Jun 2023');
    expect(formatMonthYear('de', '2023-06')).toBe('Juni 2023');
  });

  it('formatMonthYear pins full ISO timestamps to UTC (literal, zone-stable)', () => {
    // Without timeZone:'UTC' this was "Mai 2023" under America/Los_Angeles.
    expect(formatMonthYear('de', '2023-06-01T00:00:00.000Z')).toBe('Juni 2023');
    expect(formatMonthYear('en', '2023-06-01T00:00:00.000Z')).toBe('Jun 2023');
    // Year boundary: UTC midnight Jan 1 must not become Dec of previous year.
    expect(formatMonthYear('en', '2023-01-01T00:00:00Z')).toBe('Jan 2023');
    expect(formatMonthYear('de', '2023-01-01T00:00:00Z')).toBe('Jan. 2023');
    expect(formatMonthYear('ja', '')).toBeNull();
    expect(formatMonthYear('en', 'not-a-date')).toBeNull();
    expect(formatMonthYear('en', null)).toBeNull();
  });
});
