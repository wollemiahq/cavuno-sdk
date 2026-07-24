import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatMonthYear,
  formatPublishedRelativeDate,
} from './dates';
import { fullJobToCard } from './job-card';
import { fieldLabel } from './labels';
import { cardLocationLabel, locationLabel } from './location';
import { getSalaryLexicon } from './salary-lexicon';
import { formatSalaryRange } from './salary-range';

import type { PublicJob } from '../types/jobs';

// These pin the TRANSCRIPTION of the hosted formatters: the words
// and branching rules that decide what a board visitor reads. Exact
// ICU-sensitive strings (non-en Intl output) are pinned by the
// golden test against the hosted implementation itself — here we pin the
// deterministic en path byte-for-byte and the localization RULES.

describe('formatSalaryRange', () => {
  it('en keeps the legacy manual symbol-before compact form', () => {
    expect(formatSalaryRange('en', 90000, 120000, 'per_year', 'USD')).toBe(
      '$90K – $120K Yearly',
    );
    expect(formatSalaryRange('en', 90000, 120000, 'per_year', 'EUR')).toBe(
      '€90K – €120K Yearly',
    );
  });

  it('open-ended ranges use the board-language prefixes', () => {
    expect(formatSalaryRange('en', 90000, null, 'per_year', 'USD')).toBe(
      'From $90K Yearly',
    );
    expect(formatSalaryRange('en', null, 120000, 'per_year', 'USD')).toBe(
      'Up to $120K Yearly',
    );
    const deFrom = formatSalaryRange('de', 90000, null, 'per_year', 'EUR');
    expect(deFrom).toContain('ab ');
    expect(deFrom).toContain('pro Jahr');
  });

  it('de renders the timeframe word from the lexicon and Intl currency placement', () => {
    const de = formatSalaryRange('de', 90000, 120000, 'per_year', 'EUR');
    // Exact number rendering is ICU-pinned in the golden test; the rules are:
    // lexicon word, en-dash separator with spaces, no leading € (symbol sits
    // per locale, after the amount in de).
    expect(de).toContain('pro Jahr');
    expect(de).toContain(' – ');
    expect(de?.startsWith('€')).toBe(false);
  });

  it('an owner override wins ONLY when it differs from the English source word', () => {
    // Board settings pass the stored default unconditionally; an unchanged
    // default ('Yearly') must NOT block the board-language lexicon.
    expect(
      formatSalaryRange('de', 90000, 120000, 'per_year', 'EUR', {
        yearlyLabel: 'Yearly',
      }),
    ).toContain('pro Jahr');
    expect(
      formatSalaryRange('de', 90000, 120000, 'per_year', 'EUR', {
        yearlyLabel: 'Jährlich',
      }),
    ).toContain('Jährlich');
  });

  it('unseeded locales fall back to English words with locale number formatting', () => {
    const fr = formatSalaryRange('fr', 90000, null, 'per_year', 'EUR');
    expect(fr).toContain('From ');
    expect(fr).toContain('Yearly');
  });

  it('returns null with no bounds; omits the suffix for unknown timeframes', () => {
    expect(formatSalaryRange('en', null, null, 'per_year', 'USD')).toBeNull();
    expect(formatSalaryRange('en', 90000, 120000, 'per_project', 'USD')).toBe(
      '$90K – $120K',
    );
    expect(formatSalaryRange('en', 90000, 120000, null, 'USD')).toBe(
      '$90K – $120K',
    );
  });

  it('unknown currency codes render as "CODE " prefix on en', () => {
    expect(formatSalaryRange('en', 50000, null, null, 'XYZ')).toBe(
      'From XYZ 50K',
    );
  });
});

describe('getSalaryLexicon', () => {
  it('resolves de natively and falls back to en for unseeded locales', () => {
    expect(getSalaryLexicon('de').timeframe.per_year).toBe('pro Jahr');
    expect(getSalaryLexicon('de').seniority.executive).toBe('Führungskraft');
    expect(getSalaryLexicon('fr').timeframe.per_year).toBe('Yearly');
    expect(getSalaryLexicon(undefined).rangePrefix.from).toBe('From');
  });

  it('frames build board-language metadata sentences', () => {
    expect(
      getSalaryLexicon('en').frames.entitySalariesTitle({
        entity: 'JavaScript',
        range: '$70K – $90K',
      }),
    ).toBe('JavaScript Salaries ($70K – $90K/yr)');
    expect(
      getSalaryLexicon('de').frames.salariesInPlaceTitleNoRange({
        place: 'Berlin',
      }),
    ).toBe('Gehälter in Berlin');
  });
});

describe('fieldLabel', () => {
  it('localizes seniority via the lexicon', () => {
    expect(fieldLabel('en', 'mid_level')).toBe('Mid-level');
    expect(fieldLabel('de', 'executive')).toBe('Führungskraft');
    expect(fieldLabel('de', 'entry_level')).toBe('Entry-Level');
  });

  it('localizes employment and remote labels via the copy catalog', () => {
    // The hosted board renders these English unless an operator overrides
    // them; the SDK catalog carries native de/fr defaults — a recorded
    // parity-EXCEED, same direction as salaries chrome.
    expect(fieldLabel('en', 'full_time')).toBe('Full-time');
    expect(fieldLabel('de', 'full_time')).toBe('Vollzeit');
    expect(fieldLabel('de', 'on_site')).toBe('Vor Ort');
    expect(fieldLabel('fr', 'full_time')).toBe('Temps plein');
    // Unseeded languages keep the English source vocabulary.
    expect(fieldLabel('nl', 'full_time')).toBe('Full-time');
  });

  it('applies stored operator overrides (jobCardLabels) over the catalog', () => {
    expect(
      fieldLabel('de', 'full_time', {
        jobCardLabels: { fullTimeLabel: 'Festanstellung' },
      }),
    ).toBe('Festanstellung');
    expect(
      fieldLabel('de', 'entry_level', {
        jobCardLabels: { seniorityEntryLevel: 'Berufseinsteiger' },
      }),
    ).toBe('Berufseinsteiger');
    // Empty overrides are UNSET (hosted nestedStr semantics).
    expect(
      fieldLabel('de', 'executive', {
        jobCardLabels: { seniorityExecutive: ' ' },
      }),
    ).toBe('Führungskraft');
  });

  it('passes unknown values through and nulls null', () => {
    expect(fieldLabel('en', 'freelance_gig')).toBe('freelance_gig');
    expect(fieldLabel('en', null)).toBeNull();
  });
});

function job(overrides: Partial<PublicJob>): PublicJob {
  return {
    officeLocations: [],
    remoteOption: 'on_site',
    remoteWorldwide: false,
    ...overrides,
  } as PublicJob;
}

describe('locationLabel', () => {
  it('remote jobs render Remote / Remote (worldwide) regardless of office', () => {
    expect(
      locationLabel(
        'en',
        job({ remoteOption: 'remote', remoteWorldwide: true }),
      ),
    ).toBe('Remote (worldwide)');
    expect(locationLabel('en', job({ remoteOption: 'remote' }))).toBe('Remote');
  });

  it('prefers displayName, falls back to city/locality + country', () => {
    expect(
      locationLabel(
        'en',
        job({
          officeLocations: [
            { displayName: 'Berlin, Germany' },
          ] as PublicJob['officeLocations'],
        }),
      ),
    ).toBe('Berlin, Germany');
    expect(
      locationLabel(
        'en',
        job({
          officeLocations: [
            { city: 'Wien', country: 'Austria' },
          ] as PublicJob['officeLocations'],
        }),
      ),
    ).toBe('Wien, Austria');
  });

  it('hybrid appends the marker; office-less non-remote falls back to the option label', () => {
    expect(
      locationLabel(
        'en',
        job({
          remoteOption: 'hybrid',
          officeLocations: [
            { displayName: 'Paris' },
          ] as PublicJob['officeLocations'],
        }),
      ),
    ).toBe('Paris (hybrid)');
    expect(locationLabel('en', job({ remoteOption: 'hybrid' }))).toBe('Hybrid');
  });
});

describe('cardLocationLabel', () => {
  it('remote cards use the server-computed remoteLocationLabel', () => {
    expect(
      cardLocationLabel('en', {
        remoteOption: 'remote',
        remoteLocationLabel: 'Europe',
        locationLabel: null,
      }),
    ).toBe('Remote · Europe');
    expect(
      cardLocationLabel('en', {
        remoteOption: 'remote',
        remoteLocationLabel: null,
        locationLabel: null,
      }),
    ).toBe('Remote');
  });

  it('non-remote cards use the server-computed locationLabel', () => {
    expect(
      cardLocationLabel('en', {
        remoteOption: 'hybrid',
        remoteLocationLabel: null,
        locationLabel: 'Berlin, Germany (hybrid)',
      }),
    ).toBe('Berlin, Germany (hybrid)');
  });
});

describe('fullJobToCard', () => {
  it('pre-computes the card labels from the full job', () => {
    const card = fullJobToCard(
      'en',
      job({
        id: 'j1',
        slug: 'chef',
        title: 'Chef',
        remoteOption: 'remote',
        remoteWorldwide: true,
        company: {
          slug: 'acme',
          name: 'Acme',
          logoUrl: null,
        } as PublicJob['company'],
        categories: [{ slug: 'hospitality', name: 'Hospitality' }],
        skills: [{ slug: 'cooking', name: 'Cooking' }],
        links: { public: '/companies/acme/jobs/chef' } as PublicJob['links'],
      }),
    );
    expect(card.object).toBe('job_card');
    expect(card.remoteLocationLabel).toBe('Worldwide');
    expect(card.locationLabel).toBe('Remote (worldwide)');
    expect(card.company?.slug).toBe('acme');
    // The card renders taxonomy chips — dropping these is visible data loss.
    expect(card.categories).toEqual([
      { slug: 'hospitality', name: 'Hospitality' },
    ]);
    expect(card.skills).toEqual([{ slug: 'cooking', name: 'Cooking' }]);
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
    expect(
      formatPublishedRelativeDate('en', at(5 * 24 * 3600 * 1000), now),
    ).toBe('5d ago');
    expect(
      formatPublishedRelativeDate('de', at(5 * 24 * 3600 * 1000), now),
    ).toContain('5');
    expect(formatPublishedRelativeDate('en', null, now)).toBeNull();
  });

  it('formatMonthYear avoids the timezone off-by-one-month trap', () => {
    expect(formatMonthYear('en-US', '2023-06-01')).toBe('Jun 2023');
  });
});
