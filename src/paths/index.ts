/**
 * Canonical board URL paths — the single source of truth for a board's
 * public URL structure. The sitemap generator (`src/sitemap/walker.ts`)
 * and every consumer (starter navigation, platform emails) build URLs
 * from these helpers, so the structure can never drift across surfaces.
 *
 * Each `*Path` returns an absolute path (leading slash, no origin);
 * `boardUrl(origin, path)` prefixes a board origin. Pure, isomorphic,
 * zero-dependency — safe to import in server runtimes, on the edge,
 * and in the browser.
 *
 * These paths mirror the hosted board's indexed URLs exactly (migration
 * parity). Do NOT change a pattern here without updating the hosted board
 * and the sitemap golden tests in lockstep — the structure is a locked
 * cross-surface contract.
 */

/** Job detail — the canonical, indexed job URL. Requires BOTH slugs. */
export function jobDetailPath(companySlug: string, jobSlug: string): string {
  return `/companies/${companySlug}/jobs/${jobSlug}`;
}

/** Category (keyword) job listing. */
export function jobsCategoryPath(categorySlug: string): string {
  return `/jobs/${categorySlug}`;
}

/** Skill job listing. */
export function jobsSkillPath(skillSlug: string): string {
  return `/jobs/skills/${skillSlug}`;
}

/** Location job listing. */
export function jobsLocationPath(placeSlug: string): string {
  return `/jobs/locations/${placeSlug}`;
}

/** Company profile. */
export function companyPath(companySlug: string): string {
  return `/companies/${companySlug}`;
}

/** Company market (sector) listing. */
export function companyMarketPath(marketSlug: string): string {
  return `/companies/markets/${marketSlug}`;
}

/** A company's salary overview. */
export function companySalaryPath(companySlug: string): string {
  return `/companies/${companySlug}/salaries`;
}

/** Salary page for a job title. */
export function salaryTitlePath(titleSlug: string): string {
  return `/salaries/titles/${titleSlug}`;
}

/** Salary page for a skill. */
export function salarySkillPath(skillSlug: string): string {
  return `/salaries/skills/${skillSlug}`;
}

/** Salary page for a location. */
export function salaryLocationPath(placeSlug: string): string {
  return `/salaries/locations/${placeSlug}`;
}

/** Blog post. */
export function blogPostPath(postSlug: string): string {
  return `/blog/${postSlug}`;
}

/** Blog tag archive. */
export function blogTagPath(tagSlug: string): string {
  return `/blog/tag/${tagSlug}`;
}

/** Blog author archive. */
export function blogAuthorPath(authorSlug: string): string {
  return `/blog/author/${authorSlug}`;
}

/**
 * Static top-level board paths (indexed marketing + index surfaces). Kept
 * here so the sitemap and consumers share one definition of the chrome
 * routes too.
 */
export const BOARD_PATHS = {
  home: '/',
  jobs: '/jobs',
  companies: '/companies',
  salaries: '/salaries',
  salaryCompanies: '/salaries/companies',
  salaryTitles: '/salaries/titles',
  salarySkills: '/salaries/skills',
  salaryLocations: '/salaries/locations',
  blog: '/blog',
  about: '/about',
  privacyPolicy: '/privacy-policy',
  termsOfService: '/terms-of-service',
  cookiePolicy: '/cookie-policy',
  impressum: '/impressum',
  talent: '/talent',
  employers: '/employers',
  /**
   * Alert-email surfaces. Promoted out of raw literals in
   * the job-alerts composer so /go indirection and email composition share
   * one definition.
   */
  alertsManage: '/alerts/manage',
  alertsConfirm: '/alerts/confirm',
} as const;

/**
 * Email `/go` indirection paths. Pure builders so
 * Server-side email composers can emit structure-independent links without
 * importing `@cavuno/board/go` (handler code is not safe in that runtime).
 *
 * Shapes match the hosted handler + SDK `createGoHandler` contracts:
 *   /go/job/<immutableId>
 *   /go/alerts-manage
 *   /go/alerts-confirm
 *
 * No encoding — callers pass opaque Cavuno ids / static role segments that
 * are already URL-safe path segments. Query strings are composed by the
 * caller (tokens must ride through verbatim).
 */
export function goJobPath(jobId: string): string {
  return `/go/job/${jobId}`;
}

export function goAlertsManagePath(): string {
  return '/go/alerts-manage';
}

export function goAlertsConfirmPath(): string {
  return '/go/alerts-confirm';
}

/**
 * Prefix a board-relative path with the board origin. A trailing slash on
 * the origin is tolerated (stripped) so callers need not normalise first.
 */
export function boardUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}
