import {
  extractJobDetailLink,
  extractJobPostingJsonLd,
  parseSitemap,
  record,
  type CheckResult,
} from './checks';
import { probe } from './probe';

import type { BoardSeo } from '../types/seo';

/**
 *  read probes against the tenant's frontend (`--frontend <url>`):
 * home renders, /jobs carries a job DETAIL link, that page has JobPosting
 * JSON-LD, sitemap parses and a sample page resolves, robots.txt is
 * present, and platform SEO files match the dashboard snapshot. Same
 * run/skip module shape as writes.ts — every check always appears in
 * the results.
 */

export type BoardSeoSnapshot = Pick<
  BoardSeo,
  'canonicalBase' | 'adsTxt' | 'indexNowKey' | 'googleSiteVerification'
>;

// Single source for the tier-2 probe ids — the skip roster and every
// result construction go through these.
const READ = {
  home: record('read.home', 2),
  jobs: record('read.jobs', 2),
  jsonld: record('read.jsonld', 2),
  sitemap: record('read.sitemap', 2),
  robots: record('read.robots', 2),
  adsTxt: record('read.adsTxt', 2),
  indexNow: record('read.indexNow', 2),
  googleVerification: record('read.googleVerification', 2),
  oauthCallback: record('read.oauthCallback', 2),
} as const;

/** Loud-skip roster for a tier that never ran (no --frontend given). */
export function skipReadProbes(reason: string): CheckResult[] {
  return Object.values(READ).map((make) => make('skip', reason));
}

/** : /jobs listing carries a job DETAIL link, then that page's JSON-LD. */
async function probeJobsAndJsonLd(
  fetchImpl: typeof fetch,
  base: string,
): Promise<CheckResult[]> {
  const jobs = await probe(fetchImpl, `${base}/jobs`);
  const jobLink = jobs.ok ? extractJobDetailLink(jobs.body) : null;

  const jobsResult =
    jobs.ok && jobLink
      ? READ.jobs('pass', `listing renders with job detail links (${jobLink})`)
      : READ.jobs(
          'fail',
          jobs.ok
            ? 'listing renders but contains no /companies/{c}/jobs/{s} detail links'
            : `listing HTTP ${jobs.status}`,
        );

  if (!jobLink) {
    return [
      jobsResult,
      READ.jsonld(
        'skip',
        jobs.ok
          ? 'not probed — the listing rendered no job detail link (see read.jobs failure)'
          : 'not probed — the /jobs listing itself failed (see read.jobs failure)',
      ),
    ];
  }

  const detail = await probe(fetchImpl, `${base}${jobLink}`);
  const posting = detail.ok ? extractJobPostingJsonLd(detail.body) : null;
  return [
    jobsResult,
    posting
      ? READ.jsonld(
          'pass',
          `JobPosting JSON-LD present (${String(posting.title ?? '')})`,
        )
      : READ.jsonld(
          'fail',
          detail.ok
            ? 'job detail page has no parseable JobPosting JSON-LD'
            : `job detail HTTP ${detail.status}`,
        ),
  ];
}

/**
 * A sitemap <loc> carries the board's CANONICAL absolute URL (a localhost
 * starter still emits its production domain). Probe the equivalent path
 * on the frontend under test, never the canonical host.
 */
function onFrontend(base: string, locUrl: string): string {
  try {
    const parsed = new URL(locUrl);
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return locUrl;
  }
}

/**
 *sitemap parses and a PAGE from it resolves — a sitemapindex is
 * descended one level so the sample is a real page, not a child sitemap.
 */
async function probeSitemap(
  fetchImpl: typeof fetch,
  base: string,
): Promise<CheckResult> {
  const sitemap = await probe(fetchImpl, `${base}/sitemap.xml`);
  if (!sitemap.ok) {
    return READ.sitemap('fail', `sitemap.xml HTTP ${sitemap.status}`);
  }
  const doc = parseSitemap(sitemap.body);
  if (!doc || doc.urls.length === 0) {
    return READ.sitemap(
      'fail',
      doc ? 'sitemap.xml has no <loc> entries' : 'sitemap.xml is not a sitemap',
    );
  }

  let urls = doc.urls;
  if (doc.kind === 'index') {
    const childUrl = onFrontend(base, urls[0]!);
    let child = await probe(fetchImpl, childUrl);
    // Concurrent SSR on one Worker isolate 503s the first child while
    // the index is still warm (Cybersecurity marketing.xml 2026-08-25).
    if (!child.ok && (child.status === 503 || child.status === 0)) {
      child = await probe(fetchImpl, childUrl);
    }
    const childDoc = child.ok ? parseSitemap(child.body) : null;
    if (!childDoc || childDoc.urls.length === 0) {
      return READ.sitemap(
        'fail',
        `child sitemap ${urls[0]} ${child.ok ? 'has no <loc> entries' : `HTTP ${child.status}`}`,
      );
    }
    urls = childDoc.urls;
  }

  const sampleUrl = onFrontend(base, urls[0]!);
  const sample = await probe(fetchImpl, sampleUrl);
  return sample.ok
    ? READ.sitemap('pass', `${urls.length} entries; sample page resolves`)
    : READ.sitemap('fail', `sitemap page ${sampleUrl} → HTTP ${sample.status}`);
}

function scoreRobots(
  robots: { ok: boolean; status: number; body: string },
  seo: BoardSeoSnapshot | null | undefined,
): CheckResult {
  if (!robots.ok) {
    return READ.robots('fail', `robots.txt HTTP ${robots.status}`);
  }

  const missing: string[] = [];
  if (!/user-agent\s*:/i.test(robots.body)) missing.push('User-agent');
  if (!robots.body.includes('Disallow: /go/')) missing.push('Disallow: /go/');
  if (seo) {
    const canonicalBase = seo.canonicalBase.replace(/\/+$/, '');
    const sitemapLine = `Sitemap: ${canonicalBase}/sitemap.xml`;
    if (!robots.body.includes(sitemapLine)) missing.push(sitemapLine);
  }

  if (missing.includes('User-agent')) {
    return READ.robots(
      'fail',
      'robots.txt returned 200 but has no User-agent directive',
    );
  }
  // Hosted-parity lines are advice for BYO frontends, not a gate: a
  // hand-written robots.txt that predates them must not turn CI red.
  return missing.length === 0
    ? READ.robots('pass', 'present')
    : READ.robots(
        'warn',
        `robots.txt is missing ${missing.join(', ')} (hosted boards emit it)`,
      );
}

function configuredText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function scoreOptionalTextFile(options: {
  make: (typeof READ)['adsTxt'] | (typeof READ)['indexNow'];
  label: string;
  path: string;
  seo: BoardSeoSnapshot | null | undefined;
  configured: string | null | undefined;
  probed: { ok: boolean; status: number; body: string };
}): CheckResult {
  const { make, label, path, seo, probed } = options;
  if (seo == null) {
    return make('skip', 'board seo not fetched');
  }

  const expected = configuredText(options.configured);
  if (expected !== null) {
    if (!probed.ok) {
      return make('fail', `${path} HTTP ${probed.status}`);
    }
    if (probed.body.trimEnd() === expected.trimEnd()) {
      return make('pass', `${label} matches dashboard`);
    }
    return make('fail', `${path} body does not match dashboard ${label}`);
  }

  if (probed.status === 404) {
    return make('pass', 'unconfigured; 404 as expected');
  }
  if (probed.status === 200) {
    return make(
      'warn',
      `${label} served but not configured in dashboard — clone leftover?`,
    );
  }
  return make('fail', `${path} HTTP ${probed.status}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasGoogleSiteVerificationMeta(html: string, token: string): boolean {
  const escaped = escapeRegExp(token);
  const quoted = `["']${escaped}["']`;
  const name = `name\\s*=\\s*["']google-site-verification["']`;
  const content = `content\\s*=\\s*${quoted}`;
  return (
    new RegExp(`<meta\\b[^>]*\\b${name}[^>]*\\b${content}`, 'i').test(html) ||
    new RegExp(`<meta\\b[^>]*\\b${content}[^>]*\\b${name}`, 'i').test(html)
  );
}

function scoreGoogleVerification(
  homeHtml: string,
  seo: BoardSeoSnapshot | null | undefined,
): CheckResult {
  if (seo == null) {
    return READ.googleVerification('skip', 'board seo not fetched');
  }
  const token = configuredText(seo.googleSiteVerification);
  if (token === null) {
    return READ.googleVerification('skip', 'no token configured');
  }
  return hasGoogleSiteVerificationMeta(homeHtml, token)
    ? READ.googleVerification('pass', 'google-site-verification meta present')
    : READ.googleVerification(
        'fail',
        'home HTML is missing the google-site-verification meta tag',
      );
}

const OAUTH_PROVIDERS = ['google', 'linkedin'] as const;

/**
 * The dashboard's "Authorized redirect URL" is `{primary domain}/api/board-auth/
 * oauth/{provider}/callback`, served by the hosted app. A frontend
 * on that domain must forward the path or operators register a dead URL with
 * Google/LinkedIn. The hosted handler answers a bare GET with 400 "Missing
 * code or state"; anything else means the path is not forwarded. Only a
 * warning: it matters solely when the board registered its own domain.
 */
function scoreOAuthCallback(
  probed: Record<
    (typeof OAUTH_PROVIDERS)[number],
    { ok: boolean; status: number; body: string }
  >,
): CheckResult {
  const broken = OAUTH_PROVIDERS.filter(
    (provider) =>
      !(
        probed[provider].status === 400 &&
        /missing code or state/i.test(probed[provider].body)
      ),
  );
  return broken.length === 0
    ? READ.oauthCallback('pass', 'callback paths reach the hosted app')
    : READ.oauthCallback(
        'warn',
        `${broken.map((p) => `/api/board-auth/oauth/${p}/callback → HTTP ${probed[p].status}`).join(', ')} — only matters if you registered this domain's callback with the provider: forward the path to cavuno.com, or register https://cavuno.com/api/board-auth/oauth/{provider}/callback instead`,
      );
}

export async function runReadProbes(
  fetchImpl: typeof fetch,
  frontendUrl: string,
  seo?: BoardSeoSnapshot | null,
): Promise<CheckResult[]> {
  const base = frontendUrl.replace(/\/$/, '');

  // Serial on the same isolate the candidate Worker uses. Concurrent
  // home+jobs+sitemap+robots 503 the first child sitemap. ads.txt and
  // indexnow-key.txt follow robots for the same reason.
  const home = await probe(fetchImpl, base);
  const jobsAndJsonLd = await probeJobsAndJsonLd(fetchImpl, base);
  const sitemap = await probeSitemap(fetchImpl, base);
  const robots = await probe(fetchImpl, `${base}/robots.txt`);
  const adsTxt = await probe(fetchImpl, `${base}/ads.txt`);
  const indexNow = await probe(fetchImpl, `${base}/indexnow-key.txt`);
  const oauthCallback = {
    google: await probe(
      fetchImpl,
      `${base}/api/board-auth/oauth/google/callback`,
    ),
    linkedin: await probe(
      fetchImpl,
      `${base}/api/board-auth/oauth/linkedin/callback`,
    ),
  };

  return [
    home.ok && /<(html|body|div|main)[\s>]/i.test(home.body)
      ? READ.home('pass', 'home renders')
      : READ.home(
          'fail',
          home.ok
            ? 'home returned 200 but no HTML document — captive portal or empty shell?'
            : `home HTTP ${home.status}`,
        ),
    ...jobsAndJsonLd,
    sitemap,
    scoreRobots(robots, seo),
    scoreOptionalTextFile({
      make: READ.adsTxt,
      label: 'ads.txt',
      path: '/ads.txt',
      seo,
      configured: seo?.adsTxt,
      probed: adsTxt,
    }),
    scoreOptionalTextFile({
      make: READ.indexNow,
      label: 'indexnow-key.txt',
      path: '/indexnow-key.txt',
      seo,
      configured: seo?.indexNowKey,
      probed: indexNow,
    }),
    scoreGoogleVerification(home.body, seo),
    scoreOAuthCallback(oauthCallback),
  ];
}
