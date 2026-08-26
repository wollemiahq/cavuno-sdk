import {
  extractJobDetailLink,
  extractJobPostingJsonLd,
  parseSitemap,
  record,
  type CheckResult,
} from './checks';
import { probe } from './probe';

/**
 *  read probes against the tenant's frontend (`--frontend <url>`):
 * home renders, /jobs carries a job DETAIL link, that page has JobPosting
 * JSON-LD, sitemap parses and a sample page resolves, robots.txt is
 * present. Same run/skip module shape as writes.ts — every check always
 * appears in the results.
 */

// Single source for the tier-2 probe ids — the skip roster and every
// result construction go through these.
const READ = {
  home: record('read.home', 2),
  jobs: record('read.jobs', 2),
  jsonld: record('read.jsonld', 2),
  sitemap: record('read.sitemap', 2),
  robots: record('read.robots', 2),
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

export async function runReadProbes(
  fetchImpl: typeof fetch,
  frontendUrl: string,
): Promise<CheckResult[]> {
  const base = frontendUrl.replace(/\/$/, '');

  // Serial on the same isolate the candidate Worker uses. Concurrent
  // home+jobs+sitemap+robots 503 the first child sitemap.
  const home = await probe(fetchImpl, base);
  const jobsAndJsonLd = await probeJobsAndJsonLd(fetchImpl, base);
  const sitemap = await probeSitemap(fetchImpl, base);
  const robots = await probe(fetchImpl, `${base}/robots.txt`);

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
    robots.ok && /user-agent\s*:/i.test(robots.body)
      ? READ.robots('pass', 'present')
      : READ.robots(
          'fail',
          robots.ok
            ? 'robots.txt returned 200 but has no User-agent directive'
            : `robots.txt HTTP ${robots.status}`,
        ),
  ];
}
