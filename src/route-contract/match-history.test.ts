/**
 *  — pure history path matcher + ROLE_INDEX_PATHS degrade table.
 */
import { describe, expect, it } from 'vitest';

import { BOARD_PATHS } from '../paths';
import {
  matchPathAgainstHistory,
  matchPathToTemplate,
  ROLE_INDEX_PATHS,
} from './match-history';
import { ALL_ROLES, type RouteRole } from './roles';

describe('matchPathToTemplate', () => {
  it('captures :name segments (already-decoded, non-empty)', () => {
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/companies/acme/jobs/eng-1',
      ),
    ).toEqual({ companySlug: 'acme', jobSlug: 'eng-1' });
  });

  it('requires literal segments to match exactly', () => {
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/positions/acme/jobs/eng-1',
      ),
    ).toBeNull();
  });

  it('rejects segment-count mismatch', () => {
    expect(
      matchPathToTemplate('/companies/:companySlug', '/companies/acme/extra'),
    ).toBeNull();
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/companies/acme',
      ),
    ).toBeNull();
  });

  it('rejects empty capture segments', () => {
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/companies//jobs/eng-1',
      ),
    ).toBeNull();
  });

  it('does not re-decode percent-encoded segments (Next already decoded)', () => {
    // A remaining "%20" is treated as literal characters, not a space.
    expect(
      matchPathToTemplate('/jobs/:categorySlug', '/jobs/full%20stack'),
    ).toEqual({ categorySlug: 'full%20stack' });
  });

  it('rejects captures containing "/" or "\\" (open-redirect defense)', () => {
    // Pathological inputs that somehow embed a separator in a "segment".
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/companies/acme/evil/jobs/eng-1',
      ),
    ).toBeNull(); // count mismatch first

    // Backslash cannot be introduced by normal URL split either, but the
    // capture guard rejects it if present in a single segment.
    expect(
      matchPathToTemplate(
        '/companies/:companySlug/jobs/:jobSlug',
        '/companies/\\evil.com/jobs/eng-1',
      ),
    ).toBeNull();
  });

  it('treats non-":" segments as literals (no regex construction)', () => {
    // A segment that looks like a regex metachar stays a literal.
    expect(matchPathToTemplate('/jobs/(.*)', '/jobs/anything')).toBeNull();
    expect(matchPathToTemplate('/jobs/(.*)', '/jobs/(.*)')).toEqual({});
  });
});

describe('matchPathAgainstHistory', () => {
  it('returns the first matching entry (newest-first caller order)', () => {
    const hit = matchPathAgainstHistory(
      [
        {
          role: 'jobDetail',
          template: '/positions/:companySlug/:jobSlug',
        },
        {
          role: 'jobDetail',
          template: '/companies/:companySlug/jobs/:jobSlug',
        },
      ],
      '/companies/acme/jobs/eng-1',
    );
    expect(hit).toEqual({
      role: 'jobDetail',
      template: '/companies/:companySlug/jobs/:jobSlug',
      params: { companySlug: 'acme', jobSlug: 'eng-1' },
    });
  });

  it('returns null when nothing matches', () => {
    expect(
      matchPathAgainstHistory(
        [{ role: 'company', template: '/orgs/:companySlug' }],
        '/unknown/path',
      ),
    ).toBeNull();
  });
});

describe('ROLE_INDEX_PATHS', () => {
  it('covers every role in ALL_ROLES', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_INDEX_PATHS[role]).toBeDefined();
      expect(typeof ROLE_INDEX_PATHS[role]).toBe('string');
      expect(ROLE_INDEX_PATHS[role].length).toBeGreaterThan(0);
    }
  });

  it('maps parameterized families to their index surfaces', () => {
    const jobsRoles: RouteRole[] = [
      'jobDetail',
      'jobsCategory',
      'jobsSkill',
      'jobsLocation',
    ];
    for (const role of jobsRoles) {
      expect(ROLE_INDEX_PATHS[role]).toBe(BOARD_PATHS.jobs);
    }

    const companyRoles: RouteRole[] = [
      'company',
      'companyMarket',
      'companySalary',
    ];
    for (const role of companyRoles) {
      expect(ROLE_INDEX_PATHS[role]).toBe(BOARD_PATHS.companies);
    }

    expect(ROLE_INDEX_PATHS.salaryTitle).toBe(BOARD_PATHS.salaries);
    expect(ROLE_INDEX_PATHS.salarySkill).toBe(BOARD_PATHS.salaries);
    expect(ROLE_INDEX_PATHS.salaryLocation).toBe(BOARD_PATHS.salaries);

    expect(ROLE_INDEX_PATHS.blogPost).toBe(BOARD_PATHS.blog);
    expect(ROLE_INDEX_PATHS.blogTag).toBe(BOARD_PATHS.blog);
    expect(ROLE_INDEX_PATHS.blogAuthor).toBe(BOARD_PATHS.blog);

    expect(ROLE_INDEX_PATHS.alertsManage).toBe(BOARD_PATHS.home);
    expect(ROLE_INDEX_PATHS.alertsConfirm).toBe(BOARD_PATHS.home);

    // Statics map to themselves.
    expect(ROLE_INDEX_PATHS.jobs).toBe(BOARD_PATHS.jobs);
    expect(ROLE_INDEX_PATHS.companies).toBe(BOARD_PATHS.companies);
    expect(ROLE_INDEX_PATHS.about).toBe(BOARD_PATHS.about);
  });
});
