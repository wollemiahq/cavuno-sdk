/**
 * Role vocabulary for the per-board route manifest.
 *
 * Parameterized roles mirror the helpers in `../paths`; static roles mirror
 * `BOARD_PATHS` keys; `alertsManage` / `alertsConfirm` are promoted out of
 * raw literals in the job-alerts composer.
 *
 * Pure + isomorphic — imports only the sibling paths module.
 */

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

import type { ManifestV1 } from './types';

/** Every role the compiler can assign. */
export type RouteRole =
  // Parameterized helpers
  | 'jobDetail'
  | 'jobsCategory'
  | 'jobsSkill'
  | 'jobsLocation'
  | 'company'
  | 'companyMarket'
  | 'companySalary'
  | 'salaryTitle'
  | 'salarySkill'
  | 'salaryLocation'
  | 'blogPost'
  | 'blogTag'
  | 'blogAuthor'
  // BOARD_PATHS statics
  | 'home'
  | 'jobs'
  | 'companies'
  | 'salaries'
  | 'salaryCompanies'
  | 'salaryTitles'
  | 'salarySkills'
  | 'salaryLocations'
  | 'blog'
  | 'about'
  | 'privacyPolicy'
  | 'termsOfService'
  | 'cookiePolicy'
  | 'impressum'
  | 'talent'
  | 'employers'
  // Promoted alerts routes
  | 'alertsManage'
  | 'alertsConfirm';

/**
 * Exact param-name set per role, derived from each helper's signature.
 * Empty arrays = static / zero-param roles (never inferred by signature).
 */
export const ROLE_PARAM_REGISTRY: Record<RouteRole, readonly string[]> = {
  jobDetail: ['companySlug', 'jobSlug'],
  jobsCategory: ['categorySlug'],
  jobsSkill: ['skillSlug'],
  jobsLocation: ['placeSlug'],
  company: ['companySlug'],
  companyMarket: ['marketSlug'],
  companySalary: ['companySlug'],
  salaryTitle: ['titleSlug'],
  salarySkill: ['skillSlug'],
  salaryLocation: ['placeSlug'],
  blogPost: ['postSlug'],
  blogTag: ['tagSlug'],
  blogAuthor: ['authorSlug'],
  home: [],
  jobs: [],
  companies: [],
  salaries: [],
  salaryCompanies: [],
  salaryTitles: [],
  salarySkills: [],
  salaryLocations: [],
  blog: [],
  about: [],
  privacyPolicy: [],
  termsOfService: [],
  cookiePolicy: [],
  impressum: [],
  talent: [],
  employers: [],
  alertsManage: [],
  alertsConfirm: [],
};

/** Email-emitting roles — a missing one blocks publish. */
export const REQUIRED_ROLES: readonly RouteRole[] = [
  'jobDetail',
  'alertsManage',
  'alertsConfirm',
] as const;

/** All known roles (stable iteration order = registry key order). */
export const ALL_ROLES: readonly RouteRole[] = Object.keys(
  ROLE_PARAM_REGISTRY,
) as RouteRole[];

const ROLE_SET: ReadonlySet<string> = new Set(ALL_ROLES);

export function isRouteRole(value: string): value is RouteRole {
  return ROLE_SET.has(value);
}

/**
 * Identity manifest reproducing the current canonical structure from the
 * paths module. Built by calling helpers with `:param` placeholders so the
 * templates stay locked to the helpers.
 */
export const CANONICAL_MANIFEST: ManifestV1 = {
  version: 1,
  roles: {
    jobDetail: jobDetailPath(':companySlug', ':jobSlug'),
    jobsCategory: jobsCategoryPath(':categorySlug'),
    jobsSkill: jobsSkillPath(':skillSlug'),
    jobsLocation: jobsLocationPath(':placeSlug'),
    company: companyPath(':companySlug'),
    companyMarket: companyMarketPath(':marketSlug'),
    companySalary: companySalaryPath(':companySlug'),
    salaryTitle: salaryTitlePath(':titleSlug'),
    salarySkill: salarySkillPath(':skillSlug'),
    salaryLocation: salaryLocationPath(':placeSlug'),
    blogPost: blogPostPath(':postSlug'),
    blogTag: blogTagPath(':tagSlug'),
    blogAuthor: blogAuthorPath(':authorSlug'),
    home: BOARD_PATHS.home,
    jobs: BOARD_PATHS.jobs,
    companies: BOARD_PATHS.companies,
    salaries: BOARD_PATHS.salaries,
    salaryCompanies: BOARD_PATHS.salaryCompanies,
    salaryTitles: BOARD_PATHS.salaryTitles,
    salarySkills: BOARD_PATHS.salarySkills,
    salaryLocations: BOARD_PATHS.salaryLocations,
    blog: BOARD_PATHS.blog,
    about: BOARD_PATHS.about,
    privacyPolicy: BOARD_PATHS.privacyPolicy,
    termsOfService: BOARD_PATHS.termsOfService,
    cookiePolicy: BOARD_PATHS.cookiePolicy,
    impressum: BOARD_PATHS.impressum,
    talent: BOARD_PATHS.talent,
    employers: BOARD_PATHS.employers,
    alertsManage: '/alerts/manage',
    alertsConfirm: '/alerts/confirm',
  },
};
