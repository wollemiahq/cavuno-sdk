import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SORT,
  EMPLOYMENT_TYPES,
  JOB_SORTS,
  REMOTE_OPTIONS,
  SENIORITIES,
  parseCompany,
  parseListingFilters,
  parseSeniority,
  seniorityLabels,
  sortLabels,
} from './index';

// The vocabulary is the CONTRACT tenant frontends filter by — tested
// against the hosted behavior; here we pin the parsing rules
// (public-URL input is messy and must never throw) and the label locale rule.

describe('vocabulary', () => {
  it('exposes the locked sets', () => {
    expect(SENIORITIES).toHaveLength(8);
    expect(REMOTE_OPTIONS).toEqual(['on_site', 'hybrid', 'remote']);
    expect(EMPLOYMENT_TYPES).not.toContain('volunteer');
    // `oldest` is deliberately excluded.
    expect(JOB_SORTS).not.toContain('oldest');
    expect(DEFAULT_SORT).toBe('relevance');
  });
});

describe('parseSeniority (hosted semantics)', () => {
  it('accepts arrays and comma-strings', () => {
    expect(parseSeniority(['senior', 'lead'])).toEqual(['senior', 'lead']);
    expect(parseSeniority('senior,lead')).toEqual(['senior', 'lead']);
  });

  it('trims, lowercases, dedupes, and drops unknowns — hand-typed URLs', () => {
    expect(parseSeniority(' Senior , LEAD ,senior,cto')).toEqual([
      'senior',
      'lead',
    ]);
    expect(parseSeniority('cto')).toBeUndefined();
    expect(parseSeniority('')).toBeUndefined();
    expect(parseSeniority(42)).toBeUndefined();
    expect(parseSeniority([42, 'senior'])).toEqual(['senior']);
  });
});

describe('parseCompany (hosted semantics)', () => {
  it('accepts arrays and comma-strings', () => {
    expect(parseCompany(['acme', 'globex'])).toEqual(['acme', 'globex']);
    expect(parseCompany('acme,globex')).toEqual(['acme', 'globex']);
  });

  it('trims, lowercases, dedupes, and drops empties — hand-typed URLs', () => {
    expect(parseCompany(' Acme , GLOBEX ,acme,')).toEqual(['acme', 'globex']);
    expect(parseCompany('')).toBeUndefined();
    expect(parseCompany(42)).toBeUndefined();
    expect(parseCompany([42, 'acme'])).toEqual(['acme']);
  });

  it('caps at 10, keeping the first 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => `co-${i}`);
    expect(parseCompany(many)).toEqual(many.slice(0, 10));
    expect(parseCompany(many.join(','))).toEqual(many.slice(0, 10));
  });
});

describe('parseListingFilters', () => {
  it('validates each param and drops unknown values silently', () => {
    expect(
      parseListingFilters({
        q: 'chef',
        remoteOption: 'remote',
        employmentType: 'full_time',
        seniority: 'senior,lead',
        company: 'acme,globex',
        sort: 'newest',
      }),
    ).toEqual({
      q: 'chef',
      remoteOption: 'remote',
      employmentType: 'full_time',
      seniority: ['senior', 'lead'],
      company: ['acme', 'globex'],
      sort: 'newest',
    });

    expect(
      parseListingFilters({
        q: '',
        remoteOption: 'moon_base',
        employmentType: 'volunteer', // wire enum but not a filter option
        sort: 'oldest',
      }),
    ).toEqual({
      q: undefined,
      remoteOption: undefined,
      employmentType: undefined,
      seniority: undefined,
      company: undefined,
      sort: undefined,
    });
  });
});

describe('labels', () => {
  it('seniority labels localize via the lexicon per board language', () => {
    expect(seniorityLabels('en').mid_level).toBe('Mid-level');
    expect(seniorityLabels('de').executive).toBe('Führungskraft');
    expect(seniorityLabels('fr').executive).toBe('Executive'); // fallback en
  });

  it('sort labels localize via the copy catalog', () => {
    expect(sortLabels('en').relevance).toBe('AI-ranked');
    expect(sortLabels('de').relevance).toBe('KI-sortiert');
    expect(sortLabels('de').newest).toBe('Neueste zuerst');
    // Unseeded languages fall back to the English source.
    expect(sortLabels('nl')).toEqual(sortLabels('en'));
  });

  it('sort/seniority labels apply stored operator overrides (jobCardLabels)', () => {
    expect(
      sortLabels('de', { jobCardLabels: { sortNewestLabel: 'Frisch rein' } })
        .newest,
    ).toBe('Frisch rein');
    expect(
      seniorityLabels('de', {
        jobCardLabels: { seniorityLead: 'Teamleitung' },
      }).lead,
    ).toBe('Teamleitung');
  });
});
