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
} from './index';

// The vocabulary is the CONTRACT tenant frontends filter by — tested
// against the hosted behavior; here we pin the parsing rules
// (public-URL input is messy and must never throw). Display labels are
// application-owned and no longer ship from this entry.

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

  it('NFC-normalizes so composed and decomposed accents are one key', () => {
    const nfc = 'café';
    const nfd = 'café'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(parseCompany([nfc, nfd])).toEqual([nfc.normalize('NFC')]);
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

