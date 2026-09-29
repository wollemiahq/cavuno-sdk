/**
 *  — pure history path matching for hosted rename 301s
 *.
 *
 * Segment-wise matcher (no RegExp construction from templates). Templates
 * are validated at write time but stay defensive here: a segment starting
 * with ':' is a whole-segment param, a segment with fixed text before a
 * `:name` (`@:handle`) captures what follows that text, and anything else
 * is a literal.
 */

import { BOARD_PATHS } from '../paths';
import { ALL_ROLES, type RouteRole } from './roles';

/**
 * Degrade target per role when captured params no longer resolve against
 * the current template (302-class temporary redirect, never 404-from-history).
 */
export const ROLE_INDEX_PATHS: Record<RouteRole, string> = {
  jobDetail: BOARD_PATHS.jobs,
  jobsCategory: BOARD_PATHS.jobs,
  jobsSkill: BOARD_PATHS.jobs,
  jobsLocation: BOARD_PATHS.jobs,
  company: BOARD_PATHS.companies,
  companyMarket: BOARD_PATHS.companies,
  companySalary: BOARD_PATHS.companies,
  salaryTitle: BOARD_PATHS.salaries,
  salarySkill: BOARD_PATHS.salaries,
  salaryLocation: BOARD_PATHS.salaries,
  salaryCompanies: BOARD_PATHS.salaries,
  salaryTitles: BOARD_PATHS.salaries,
  salarySkills: BOARD_PATHS.salaries,
  salaryLocations: BOARD_PATHS.salaries,
  salaries: BOARD_PATHS.salaries,
  blogPost: BOARD_PATHS.blog,
  blogTag: BOARD_PATHS.blog,
  blogAuthor: BOARD_PATHS.blog,
  blog: BOARD_PATHS.blog,
  talentProfile: BOARD_PATHS.talent,
  home: BOARD_PATHS.home,
  jobs: BOARD_PATHS.jobs,
  companies: BOARD_PATHS.companies,
  about: BOARD_PATHS.about,
  privacyPolicy: BOARD_PATHS.privacyPolicy,
  termsOfService: BOARD_PATHS.termsOfService,
  cookiePolicy: BOARD_PATHS.cookiePolicy,
  impressum: BOARD_PATHS.impressum,
  talent: BOARD_PATHS.talent,
  employers: BOARD_PATHS.employers,
  alertsManage: BOARD_PATHS.home,
  alertsConfirm: BOARD_PATHS.home,
};

// Exhaustiveness: every ALL_ROLES entry must appear above.
const _roleIndexExhaustive: Record<RouteRole, string> = ROLE_INDEX_PATHS;
void _roleIndexExhaustive;
void ALL_ROLES;

function splitSegments(path: string): string[] {
  // Keep empty middle segments so empty-capture cases fail cleanly.
  const withoutLeading = path.startsWith('/') ? path.slice(1) : path;
  const withoutTrailing =
    withoutLeading.length > 1 && withoutLeading.endsWith('/')
      ? withoutLeading.slice(0, -1)
      : withoutLeading;
  if (withoutTrailing === '') return [];
  return withoutTrailing.split('/');
}

/** Fixed text, then a `:name` param, then optional fixed text (`@:handle`). */
const PREFIXED_PARAM_RE = /^([^:]+):([A-Za-z_][A-Za-z0-9_]*)(.*)$/;

/**
 * Segment-wise match of `pathname` against a URLPattern-style `:param` template.
 * Returns captured params or null.
 *
 * Contract: path segments arrive ALREADY decoded (Next.js `params.rest`,
 * URL routers). This function does NOT call decodeURIComponent — a second
 * decode would turn a once-decoded `%2F` into a literal `/` and enable
 * open-redirect targets when substituted into param-leading templates.
 *
 * Defense in depth: any capture containing `/` or `\` is rejected (null).
 */
export function matchPathToTemplate(
  template: string,
  pathname: string,
): Record<string, string> | null {
  const templateSegs = splitSegments(template);
  const pathSegs = splitSegments(pathname);

  if (templateSegs.length !== pathSegs.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < templateSegs.length; i++) {
    const tSeg = templateSegs[i]!;
    const pSeg = pathSegs[i]!;

    let name: string | null = null;
    let value = pSeg;
    if (tSeg.startsWith(':') && tSeg.length > 1) {
      name = tSeg.slice(1);
    } else {
      const prefixed = PREFIXED_PARAM_RE.exec(tSeg);
      if (prefixed) {
        const [, prefix = '', param = '', suffix = ''] = prefixed;
        if (!pSeg.startsWith(prefix) || !pSeg.endsWith(suffix)) return null;
        name = param;
        value = pSeg.slice(prefix.length, pSeg.length - suffix.length);
      }
    }
    if (name !== null) {
      if (value.length === 0) return null;
      // Reject path separators inside a capture (defense in depth).
      if (value.includes('/') || value.includes('\\')) return null;
      params[name] = value;
      continue;
    }

    // Literal: no param token in this segment.
    if (tSeg !== pSeg) return null;
  }

  return params;
}

export type HistoryMatchEntry = {
  role: RouteRole;
  template: string;
};

export type HistoryMatchResult = {
  role: RouteRole;
  template: string;
  params: Record<string, string>;
};

/**
 * First match wins — caller orders entries newest-first.
 */
export function matchPathAgainstHistory(
  entries: readonly HistoryMatchEntry[],
  pathname: string,
): HistoryMatchResult | null {
  for (const entry of entries) {
    const params = matchPathToTemplate(entry.template, pathname);
    if (params !== null) {
      return {
        role: entry.role,
        template: entry.template,
        params,
      };
    }
  }
  return null;
}
