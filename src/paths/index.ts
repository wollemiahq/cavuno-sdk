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
 * Dynamic path segments are percent-encoded (URI, not bare IRI) so
 * non-Latin board-language slugs (`SuggestionPathInput.canonicalSlug`)
 * are legal in sitemap `<loc>`, canonical/`og:url`, and email links.
 * Separators (`/`) are never encoded; already-encoded input is not
 * double-encoded.
 *
 * These paths mirror the hosted board's indexed URLs exactly (migration
 * parity). Do NOT change a pattern here without updating the hosted board
 * and the sitemap golden tests in lockstep — the structure is a locked
 * cross-surface contract.
 */

/**
 * Percent-encode one path segment for use in a URL path.
 * Round-trips already-encoded input so `%E6…` is not double-encoded.
 * Does not touch path separators — callers encode segments only.
 *
 * `:` is left unencoded so route-contract / well-known templates built via
 * `jobDetailPath(':companySlug', ':jobSlug')` stay RFC-6570-style. Real
 * board slugs are alphanumeric-plus-hyphen; non-ASCII is still encoded.
 */
export function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment)).replace(
      /%3A/gi,
      ':',
    );
  } catch {
    // Malformed % sequences — encode the raw string once.
    return encodeURIComponent(segment).replace(/%3A/gi, ':');
  }
}

/** Job detail — the canonical, indexed job URL. Requires BOTH slugs. */
export function jobDetailPath(companySlug: string, jobSlug: string): string {
  return `/companies/${encodePathSegment(companySlug)}/jobs/${encodePathSegment(jobSlug)}`;
}

/** Category (keyword) job listing. */
export function jobsCategoryPath(categorySlug: string): string {
  return `/jobs/${encodePathSegment(categorySlug)}`;
}

/** Skill job listing. */
export function jobsSkillPath(skillSlug: string): string {
  return `/jobs/skills/${encodePathSegment(skillSlug)}`;
}

/** Location job listing. */
export function jobsLocationPath(placeSlug: string): string {
  return `/jobs/locations/${encodePathSegment(placeSlug)}`;
}

/**
 * Location + category combination job listing
 * (`/jobs/locations/<place>/<category>`).
 */
export function jobsLocationCategoryPath(
  placeSlug: string,
  categorySlug: string,
): string {
  return `${jobsLocationPath(placeSlug)}/${encodePathSegment(categorySlug)}`;
}

/**
 * Location + skill combination job listing
 * (`/jobs/locations/<place>/skills/<skill>`).
 */
export function jobsLocationSkillPath(
  placeSlug: string,
  skillSlug: string,
): string {
  return `${jobsLocationPath(placeSlug)}/skills/${encodePathSegment(skillSlug)}`;
}

/** Company profile. */
export function companyPath(companySlug: string): string {
  return `/companies/${encodePathSegment(companySlug)}`;
}

/** Company market (sector) listing. */
export function companyMarketPath(marketSlug: string): string {
  return `/companies/markets/${encodePathSegment(marketSlug)}`;
}

/**
 * Suggestion kinds `suggestionPath` understands. Mirrors the wire
 * `SuggestionItem` discriminators (and `termType` for terms) without
 * importing generated OpenAPI types into the paths entry.
 */
export type SuggestionPathInput =
  | { type: 'company'; slug: string }
  | { type: 'market'; slug: string }
  | { type: 'post'; slug: string }
  | { type: 'tag'; slug: string }
  | {
      type: 'term';
      termType: 'category' | 'skill';
      /** Board-language URL slug — use `canonicalSlug` from the wire item. */
      canonicalSlug: string;
    };

/** Search scopes that own different destinations for the same suggestion. */
export type SuggestionPathScope = 'jobs' | 'companies' | 'blog';

export type SuggestionPathOptions = {
  scope: SuggestionPathScope;
  /**
   * Active place slug. When set on the `jobs` scope with a category or
   * skill term, routes into the location combination pages.
   */
  location?: string;
};

/**
 * Resolve a suggestion to a board-relative path for the given search scope
 * The API never returns an `href` because the same
 * `CompanySuggestion` means "navigate to the company page" under companies
 * scope and "apply a `companySlug` filter" under jobs scope — only the app
 * knows which.
 *
 * Returns `null` when the selection is not a navigation (jobs-scope company
 * → filter, or a kind that has no path under the active scope). Compose from
 * the existing `*Path` helpers; never string-build at the call site.
 *
 * | scope | suggestion | result |
 * | --- | --- | --- |
 * | jobs | skill | `/jobs/skills/<slug>` |
 * | jobs | category | `/jobs/<slug>` |
 * | jobs | skill + location | `/jobs/locations/<loc>/skills/<slug>` |
 * | jobs | category + location | `/jobs/locations/<loc>/<slug>` |
 * | jobs | company | `null` (apply `companySlug` filter) |
 * | jobs | market | `null` |
 * | jobs | post / tag | `null` |
 * | companies | company | `/companies/<slug>` |
 * | companies | market | `/companies/markets/<slug>` |
 * | companies | term / post / tag | `null` |
 * | blog | post | `/blog/<slug>` |
 * | blog | tag | `/blog/tag/<slug>` |
 * | blog | other | `null` |
 */
export function suggestionPath(
  suggestion: SuggestionPathInput,
  options: SuggestionPathOptions,
): string | null {
  const location = options.location?.trim() || undefined;

  if (options.scope === 'blog') {
    if (suggestion.type === 'post') {
      return blogPostPath(suggestion.slug);
    }
    if (suggestion.type === 'tag') {
      return blogTagPath(suggestion.slug);
    }
    return null;
  }

  if (options.scope === 'jobs') {
    if (
      suggestion.type === 'company' ||
      suggestion.type === 'market' ||
      suggestion.type === 'post' ||
      suggestion.type === 'tag'
    ) {
      return null;
    }
    if (suggestion.termType === 'skill') {
      return location
        ? jobsLocationSkillPath(location, suggestion.canonicalSlug)
        : jobsSkillPath(suggestion.canonicalSlug);
    }
    // category
    return location
      ? jobsLocationCategoryPath(location, suggestion.canonicalSlug)
      : jobsCategoryPath(suggestion.canonicalSlug);
  }

  // companies scope
  if (suggestion.type === 'company') {
    return companyPath(suggestion.slug);
  }
  if (suggestion.type === 'market') {
    return companyMarketPath(suggestion.slug);
  }
  return null;
}

/** A company's salary overview. */
export function companySalaryPath(companySlug: string): string {
  return `/companies/${encodePathSegment(companySlug)}/salaries`;
}

/** Salary page for a job title. */
export function salaryTitlePath(titleSlug: string): string {
  return `/salaries/titles/${encodePathSegment(titleSlug)}`;
}

/** Salary page for a skill. */
export function salarySkillPath(skillSlug: string): string {
  return `/salaries/skills/${encodePathSegment(skillSlug)}`;
}

/** Salary page for a location. */
export function salaryLocationPath(placeSlug: string): string {
  return `/salaries/locations/${encodePathSegment(placeSlug)}`;
}

/** Blog post. */
export function blogPostPath(postSlug: string): string {
  return `/blog/${encodePathSegment(postSlug)}`;
}

/** Blog tag archive. */
export function blogTagPath(tagSlug: string): string {
  return `/blog/tag/${encodePathSegment(tagSlug)}`;
}

/** Blog author archive. */
export function blogAuthorPath(authorSlug: string): string {
  return `/blog/author/${encodePathSegment(authorSlug)}`;
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
 * Paths from `*Path` helpers already percent-encode dynamic segments.
 */
export function boardUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}
