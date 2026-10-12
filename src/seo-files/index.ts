/**
 * `@cavuno/board/seo-files` — platform-owned crawler/identity file bodies
 * (`robots.txt`, `ads.txt`, `indexnow-key.txt`) plus the Google
 * site-verification meta descriptor.
 *
 * Pure, dependency-free: type-only import of `BoardSeo`. No node builtins,
 * no framework packages. Hosted routes, the dispatch Worker, and the starter
 * share these bytes so the files cannot drift.
 */

import type { BoardSeo } from '../types/seo';

export const SEO_FILE_CONTENT_TYPE = 'text/plain; charset=utf-8';
export const ROBOTS_CACHE_CONTROL =
  'public, max-age=600, s-maxage=14400, stale-while-revalidate=86400';
export const ADS_TXT_CACHE_CONTROL = 'public, max-age=3600, must-revalidate';
export const INDEXNOW_CACHE_CONTROL = 'public, max-age=86400, must-revalidate';

export type SeoFileResponseInit = { method?: string };

/**
 * The board's own listing roots, for boards that rename or localize their
 * URL words (for example `/vacatures` in place of `/jobs`). Each root scopes
 * one group of pagination `Disallow` rules. A missing, root (`/`) or unsafe
 * value keeps the default English root for that group.
 */
export type RobotsListingPaths = {
  jobs?: string | null;
  companies?: string | null;
  talent?: string | null;
};

const DEFAULT_LISTING_PATHS = {
  jobs: '/jobs',
  companies: '/companies',
  talent: '/talent',
} as const;

/** A plain path segment run: no robots wildcards, query, fragment or whitespace. */
const SAFE_LISTING_ROOT = /^(?:\/[^\s/*$?#]+)+$/;

function safeListingRoot(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const root = value.replace(/\/+$/, '');
  return SAFE_LISTING_ROOT.test(root) ? root : null;
}

function listingRoot(value: string | null | undefined, fallback: string) {
  return safeListingRoot(value) ?? fallback;
}

const LISTING_GROUPS = ['jobs', 'companies', 'talent'] as const;

function paginationRules(root: string): string[] {
  return [
    `Disallow: ${root}?page=`,
    `Disallow: ${root}*&page=`,
    `Disallow: ${root}/*?page=`,
  ];
}

/** Lines of the hosted robots body (no sitemap line). Exported so tests and hosted can share the literal. */
export function robotsBody(input: {
  canonicalBase: string;
  sandbox?: boolean;
  listingPaths?: RobotsListingPaths | null;
  /**
   * Listing roots of the board's secondary languages, served under a
   * language prefix with that language's own URL words (for example
   * `/de/stellen`). Each safe root adds one group of pagination rules after
   * the base ones, in order. A missing, root or unsafe value adds nothing,
   * and a root already listed is not repeated.
   */
  localeListingPaths?: readonly RobotsListingPaths[] | null;
}): string {
  if (input.sandbox) {
    return ['User-Agent: *', 'Disallow: /', ''].join('\n');
  }
  const canonicalBase = input.canonicalBase.replace(/\/+$/, '');
  const paths = input.listingPaths ?? {};
  const baseRoots = LISTING_GROUPS.map((group) =>
    listingRoot(paths[group], DEFAULT_LISTING_PATHS[group]),
  );
  const seen = new Set(baseRoots);
  const localeRoots: string[] = [];
  for (const locale of input.localeListingPaths ?? []) {
    for (const group of LISTING_GROUPS) {
      const root = safeListingRoot(locale[group]);
      if (root === null || seen.has(root)) continue;
      seen.add(root);
      localeRoots.push(root);
    }
  }
  return [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /go/',
    'Disallow: /t/',
    ...baseRoots.flatMap(paginationRules),
    ...localeRoots.flatMap(paginationRules),
    '',
    `Sitemap: ${canonicalBase}/sitemap.xml`,
    '',
  ].join('\n');
}

export function robotsResponse(
  seo: Pick<BoardSeo, 'canonicalBase'> & {
    sandbox?: boolean;
    listingPaths?: RobotsListingPaths | null;
    localeListingPaths?: readonly RobotsListingPaths[] | null;
  },
  init?: SeoFileResponseInit,
): Response {
  return textFileResponse(
    robotsBody({
      canonicalBase: seo.canonicalBase,
      sandbox: seo.sandbox,
      listingPaths: seo.listingPaths,
      localeListingPaths: seo.localeListingPaths,
    }),
    ROBOTS_CACHE_CONTROL,
    init,
  );
}

export function adsTxtResponse(
  seo: Pick<BoardSeo, 'adsTxt'>,
  init?: SeoFileResponseInit,
): Response {
  return optionalTextFileResponse(seo.adsTxt, ADS_TXT_CACHE_CONTROL, init);
}

export function indexNowResponse(
  seo: Pick<BoardSeo, 'indexNowKey'>,
  init?: SeoFileResponseInit,
): Response {
  return optionalTextFileResponse(
    seo.indexNowKey,
    INDEXNOW_CACHE_CONTROL,
    init,
  );
}

export function googleSiteVerificationMeta(
  token: string | null | undefined,
): { name: 'google-site-verification'; content: string } | null {
  if (typeof token !== 'string') return null;
  const content = token.trim();
  if (!content) return null;
  return { name: 'google-site-verification', content };
}

function isHead(init?: SeoFileResponseInit): boolean {
  return init?.method?.toUpperCase() === 'HEAD';
}

function textFileResponse(
  body: string,
  cacheControl: string,
  init?: SeoFileResponseInit,
): Response {
  return new Response(isHead(init) ? null : body, {
    status: 200,
    headers: {
      'Content-Type': SEO_FILE_CONTENT_TYPE,
      'Cache-Control': cacheControl,
    },
  });
}

function optionalTextFileResponse(
  value: string | null | undefined,
  cacheControl: string,
  init?: SeoFileResponseInit,
): Response {
  if (value == null || value === '') {
    return new Response(null, { status: 404 });
  }
  return textFileResponse(value, cacheControl, init);
}
