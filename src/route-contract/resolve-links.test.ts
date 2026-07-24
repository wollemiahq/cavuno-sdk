/**
 *  — platform resolution overlay.
 *
 * Pure resolver: declared > wellKnown > inferred > CANONICAL_MANIFEST.
 */
import { describe, expect, it } from 'vitest';

import {
  BOARD_PATHS,
  blogAuthorPath,
  blogPostPath,
  blogTagPath,
  companyMarketPath,
  companyPath,
  companySalaryPath,
  jobDetailPath,
  jobsCategoryPath,
  jobsLocationPath,
  jobsSkillPath,
  salaryLocationPath,
  salarySkillPath,
  salaryTitlePath,
} from '../paths';
import {
  createBoardLinkResolver,
  type ManifestLayer,
  type ResolvedBoardPath,
} from './resolve-links';
import {
  ALL_ROLES,
  CANONICAL_MANIFEST,
  REQUIRED_ROLES,
  ROLE_PARAM_REGISTRY,
  type RouteRole,
} from './roles';

import type { ManifestV1 } from './types';

/** Sample params covering every registry token used by parameterized roles. */
const SAMPLE_PARAMS: Record<string, string> = {
  companySlug: 'acme',
  jobSlug: 'senior-eng',
  categorySlug: 'engineering',
  skillSlug: 'typescript',
  placeSlug: 'berlin',
  marketSlug: 'fintech',
  titleSlug: 'software-engineer',
  postSlug: 'hello-world',
  tagSlug: 'announcements',
  authorSlug: 'jane',
};

/** Canonical path via the paths helpers / BOARD_PATHS — equivalence oracle. */
function canonicalHelperPath(role: RouteRole): string {
  switch (role) {
    case 'jobDetail':
      return jobDetailPath(SAMPLE_PARAMS.companySlug!, SAMPLE_PARAMS.jobSlug!);
    case 'jobsCategory':
      return jobsCategoryPath(SAMPLE_PARAMS.categorySlug!);
    case 'jobsSkill':
      return jobsSkillPath(SAMPLE_PARAMS.skillSlug!);
    case 'jobsLocation':
      return jobsLocationPath(SAMPLE_PARAMS.placeSlug!);
    case 'company':
      return companyPath(SAMPLE_PARAMS.companySlug!);
    case 'companyMarket':
      return companyMarketPath(SAMPLE_PARAMS.marketSlug!);
    case 'companySalary':
      return companySalaryPath(SAMPLE_PARAMS.companySlug!);
    case 'salaryTitle':
      return salaryTitlePath(SAMPLE_PARAMS.titleSlug!);
    case 'salarySkill':
      return salarySkillPath(SAMPLE_PARAMS.skillSlug!);
    case 'salaryLocation':
      return salaryLocationPath(SAMPLE_PARAMS.placeSlug!);
    case 'blogPost':
      return blogPostPath(SAMPLE_PARAMS.postSlug!);
    case 'blogTag':
      return blogTagPath(SAMPLE_PARAMS.tagSlug!);
    case 'blogAuthor':
      return blogAuthorPath(SAMPLE_PARAMS.authorSlug!);
    case 'home':
    case 'jobs':
    case 'companies':
    case 'salaries':
    case 'salaryCompanies':
    case 'salaryTitles':
    case 'salarySkills':
    case 'salaryLocations':
    case 'blog':
    case 'about':
    case 'privacyPolicy':
    case 'termsOfService':
    case 'cookiePolicy':
    case 'impressum':
    case 'talent':
    case 'employers':
    case 'alertsManage':
    case 'alertsConfirm':
      return BOARD_PATHS[role];
    default: {
      const _exhaustive: never = role;
      throw new Error(`unhandled role: ${_exhaustive}`);
    }
  }
}

function paramsFor(role: RouteRole): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of ROLE_PARAM_REGISTRY[role]) {
    const value = SAMPLE_PARAMS[name];
    if (value === undefined) {
      throw new Error(`SAMPLE_PARAMS missing ${name} for ${role}`);
    }
    out[name] = value;
  }
  return out;
}

function layer(
  source: ManifestLayer['source'],
  roles: Partial<Record<RouteRole, string>>,
): ManifestLayer {
  return { source, manifest: { version: 1, roles } satisfies ManifestV1 };
}

function assertNoColonTokens(result: ResolvedBoardPath) {
  expect(
    result.path.includes(':'),
    `path has colon token: ${result.path}`,
  ).toBe(false);
}

// ──  ────────────────────────────────────────────────────────────────
describe('createBoardLinkResolver', () => {
  it('zero layers returns byte-identical paths to canonical helpers for every role', () => {
    const resolver = createBoardLinkResolver([]);

    for (const role of ALL_ROLES) {
      const expected = canonicalHelperPath(role);
      const result = resolver.pathFor(role, paramsFor(role));
      expect(result.path, role).toBe(expected);
      expect(result.source, role).toBe('canonical');
      expect(result.fallback, role).toBeUndefined();
      assertNoColonTokens(result);
      // CANONICAL_MANIFEST identity: substituted template equals helper
      expect(CANONICAL_MANIFEST.roles[role]).toBeTypeOf('string');
    }
  });

  // ──  ──────────────────────────────────────────────────────────────
  it('declared overrides only its assigned roles; absent roles fall through', () => {
    const resolver = createBoardLinkResolver([
      layer('declared', {
        jobDetail: '/positions/:jobSlug',
        company: '/orgs/:companySlug',
      }),
    ]);

    const job = resolver.pathFor('jobDetail', paramsFor('jobDetail'));
    expect(job).toEqual({
      path: '/positions/senior-eng',
      source: 'declared',
    });

    const company = resolver.pathFor('company', paramsFor('company'));
    expect(company).toEqual({
      path: '/orgs/acme',
      source: 'declared',
    });

    const jobs = resolver.pathFor('jobs');
    expect(jobs).toEqual({
      path: BOARD_PATHS.jobs,
      source: 'canonical',
    });

    const blog = resolver.pathFor('blogPost', paramsFor('blogPost'));
    expect(blog).toEqual({
      path: blogPostPath(SAMPLE_PARAMS.postSlug!),
      source: 'canonical',
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  it('declared beats wellKnown beats inferred for the same role', () => {
    const resolver = createBoardLinkResolver([
      layer('inferred', { company: '/inferred/:companySlug' }),
      layer('declared', { company: '/declared/:companySlug' }),
      layer('wellKnown', { company: '/well-known/:companySlug' }),
    ]);

    expect(resolver.pathFor('company', paramsFor('company'))).toEqual({
      path: '/declared/acme',
      source: 'declared',
    });

    const withoutDeclared = createBoardLinkResolver([
      layer('inferred', { company: '/inferred/:companySlug' }),
      layer('wellKnown', { company: '/well-known/:companySlug' }),
    ]);
    expect(withoutDeclared.pathFor('company', paramsFor('company'))).toEqual({
      path: '/well-known/acme',
      source: 'wellKnown',
    });

    const inferredOnly = createBoardLinkResolver([
      layer('inferred', { company: '/inferred/:companySlug' }),
    ]);
    expect(inferredOnly.pathFor('company', paramsFor('company'))).toEqual({
      path: '/inferred/acme',
      source: 'inferred',
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  it('inferred never serves REQUIRED_ROLES; non-required still resolves inferred', () => {
    const resolver = createBoardLinkResolver([
      layer('inferred', {
        jobDetail: '/inferred-jobs/:companySlug/:jobSlug',
        company: '/inferred-co/:companySlug',
        alertsManage: '/inferred-alerts',
      }),
    ]);

    // Required: jobDetail falls through to canonical despite inferred layer
    expect(resolver.pathFor('jobDetail', paramsFor('jobDetail'))).toEqual({
      path: jobDetailPath(SAMPLE_PARAMS.companySlug!, SAMPLE_PARAMS.jobSlug!),
      source: 'canonical',
    });

    expect(resolver.pathFor('alertsManage')).toEqual({
      path: BOARD_PATHS.alertsManage,
      source: 'canonical',
    });

    // Non-required: inferred wins
    expect(resolver.pathFor('company', paramsFor('company'))).toEqual({
      path: '/inferred-co/acme',
      source: 'inferred',
    });

    // Sanity: every required role is covered by the defense
    for (const role of REQUIRED_ROLES) {
      const result = resolver.pathFor(role, paramsFor(role));
      expect(result.source, role).toBe('canonical');
    }
  });

  // ──  ──────────────────────────────────────────────────────────────
  it('missing param falls back to canonical + flag; never emits ":" tokens', () => {
    // Declared needs jobSlug; caller omits it → canonical + fallback
    const resolver = createBoardLinkResolver([
      layer('declared', {
        jobDetail: '/positions/:jobSlug',
        company: '/orgs/:companySlug/:extraToken',
      }),
    ]);

    const missingJobSlug = resolver.pathFor('jobDetail', {
      companySlug: SAMPLE_PARAMS.companySlug!,
      // jobSlug intentionally omitted
    });
    expect(missingJobSlug.source).toBe('canonical');
    expect(missingJobSlug.fallback).toBe('missing-param');
    // Canonical also needs jobSlug — incomplete; path must still lack ':'
    assertNoColonTokens(missingJobSlug);

    // Non-registry token in declared → missing-param fallback with full
    // registry params → complete canonical path
    const nonRegistry = resolver.pathFor('company', paramsFor('company'));
    expect(nonRegistry).toEqual({
      path: companyPath(SAMPLE_PARAMS.companySlug!),
      source: 'canonical',
      fallback: 'missing-param',
    });
    assertNoColonTokens(nonRegistry);

    // Partial params that complete declared after fall-through? Full sample
    // with declared needing an extra param we do not have:
    const fullParamsMissingDeclared = resolver.pathFor('jobDetail', {
      companySlug: SAMPLE_PARAMS.companySlug!,
      jobSlug: SAMPLE_PARAMS.jobSlug!,
    });
    // declared only needs jobSlug — should succeed from declared
    expect(fullParamsMissingDeclared).toEqual({
      path: '/positions/senior-eng',
      source: 'declared',
    });

    // Table: every role with zero layers + full params has no colon
    const zero = createBoardLinkResolver([]);
    for (const role of ALL_ROLES) {
      assertNoColonTokens(zero.pathFor(role, paramsFor(role)));
    }

    // Declared incomplete → canonical complete when full registry params given
    // but declared has a non-registry token:
    const incompleteDeclared = createBoardLinkResolver([
      layer('declared', {
        jobDetail: '/x/:companySlug/:jobSlug/:unknown',
      }),
    ]);
    const r = incompleteDeclared.pathFor('jobDetail', paramsFor('jobDetail'));
    expect(r.path).toBe(
      jobDetailPath(SAMPLE_PARAMS.companySlug!, SAMPLE_PARAMS.jobSlug!),
    );
    expect(r.source).toBe('canonical');
    expect(r.fallback).toBe('missing-param');
    assertNoColonTokens(r);
  });

  it('skips empty-string role templates and consults the next layer', () => {
    const resolver = createBoardLinkResolver([
      layer('declared', { company: '' }),
      layer('wellKnown', { company: '/wk/:companySlug' }),
    ]);
    expect(resolver.pathFor('company', paramsFor('company'))).toEqual({
      path: '/wk/acme',
      source: 'wellKnown',
    });
  });
});
