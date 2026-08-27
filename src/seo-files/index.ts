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

/** Lines of the hosted robots body (no sitemap line). Exported so tests and hosted can share the literal. */
export function robotsBody(input: {
  canonicalBase: string;
  sandbox?: boolean;
}): string {
  if (input.sandbox) {
    return ['User-Agent: *', 'Disallow: /', ''].join('\n');
  }
  const canonicalBase = input.canonicalBase.replace(/\/+$/, '');
  return [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /go/',
    'Disallow: /t/',
    'Disallow: /jobs?page=',
    'Disallow: /jobs*&page=',
    'Disallow: /jobs/*?page=',
    'Disallow: /companies?page=',
    'Disallow: /companies*&page=',
    'Disallow: /companies/*?page=',
    'Disallow: /talent?page=',
    'Disallow: /talent*&page=',
    'Disallow: /talent/*?page=',
    '',
    `Sitemap: ${canonicalBase}/sitemap.xml`,
    '',
  ].join('\n');
}

export function robotsResponse(
  seo: Pick<BoardSeo, 'canonicalBase'> & { sandbox?: boolean },
  init?: SeoFileResponseInit,
): Response {
  return textFileResponse(
    robotsBody({ canonicalBase: seo.canonicalBase, sandbox: seo.sandbox }),
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
