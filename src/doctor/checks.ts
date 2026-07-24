/**
 * Doctor check primitives: the pure logic behind
 * `npx @cavuno/board doctor` — env validation, JSON-LD extraction,
 * sitemap parsing, and the pass/fail/skip summary. Everything here is
 * synchronous and I/O-free so it unit-tests without a network; the
 * orchestrator in run.ts owns the fetches.
 */

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  id: string;
  /** 1 static · 2 read probes. */
  tier: 1 | 2;
  status: CheckStatus;
  detail: string;
}

/** Curried result builder — one shape, no per-check object literals. */
export function record(id: string, tier: 1 | 2) {
  return (status: CheckStatus, detail: string): CheckResult => ({
    id,
    tier,
    status,
    detail,
  });
}

const ENV_API_URL = record('env.api-url', 1);
const ENV_BOARD_KEY = record('env.board-key', 1);

const PK_RE = /^pk_[0-9a-f]{32}$/;

export interface DoctorEnv {
  apiUrl?: string;
  boardKey?: string;
}

/**
 * API base for probe URLs — trailing slashes stripped, path prefix
 * preserved. Mirrors BoardClient's basePath derivation (client.ts):
 * `https://cavuno.com/api` must probe `/api/v1/…`; reducing to the URL
 * origin drops the prefix and 404s every check.
 */
export function apiBase(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '');
}

/**  static env checks — presence and shape, no network. */
export function checkEnv(env: DoctorEnv): CheckResult[] {
  const results: CheckResult[] = [];

  if (!env.apiUrl) {
    results.push(ENV_API_URL('fail', 'PUBLIC_CAVUNO_API_URL is not set'));
  } else {
    let origin: string | null = null;
    try {
      origin = new URL(env.apiUrl).origin;
    } catch {
      origin = null;
    }
    results.push(
      origin
        ? ENV_API_URL('pass', origin)
        : ENV_API_URL(
            'fail',
            `PUBLIC_CAVUNO_API_URL is not a valid URL: ${env.apiUrl}`,
          ),
    );
  }

  if (!env.boardKey) {
    results.push(ENV_BOARD_KEY('fail', 'PUBLIC_CAVUNO_BOARD is not set'));
  } else {
    results.push(
      PK_RE.test(env.boardKey)
        ? ENV_BOARD_KEY('pass', 'pk_ key')
        : ENV_BOARD_KEY(
            'fail',
            'PUBLIC_CAVUNO_BOARD must be a publishable key (pk_ + 32 hex chars)',
          ),
    );
  }

  return results;
}

/**
 * A job DETAIL link. On both hosted boards and the starter, job details
 * live at `/companies/{companySlug}/jobs/{jobSlug}` — `/jobs/{x}` is
 * always a listing (keyword/location page), never a job.
 */
const JOB_DETAIL_LINK_RE =
  /href="(\/companies\/[a-z0-9-]+\/jobs\/[a-z0-9-]+)"/i;

export function extractJobDetailLink(html: string): string | null {
  return html.match(JOB_DETAIL_LINK_RE)?.[1] ?? null;
}

const JSON_LD_RE =
  /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Find the JobPosting JSON-LD block in a rendered page, if any. Tolerant:
 * multiple ld+json scripts, malformed JSON in one block doesn't poison
 * the rest.
 */
export function extractJobPostingJsonLd(
  html: string,
): Record<string, unknown> | null {
  for (const match of html.matchAll(JSON_LD_RE)) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as Record<string, unknown>;
      if (parsed['@type'] === 'JobPosting') return parsed;
    } catch {
      // Malformed block — keep scanning; the caller decides pass/fail on null.
    }
  }
  return null;
}

const LOC_RE = /<loc>([^<]+)<\/loc>/gi;

export interface SitemapDocument {
  /** `urlset` entries are pages; `index` entries are child sitemaps. */
  kind: 'urlset' | 'index';
  urls: string[];
}

/** Parse a sitemap body, preserving the urlset/sitemapindex distinction. */
export function parseSitemap(xml: string): SitemapDocument | null {
  const kind = /<urlset[\s>]/i.test(xml)
    ? ('urlset' as const)
    : /<sitemapindex[\s>]/i.test(xml)
      ? ('index' as const)
      : null;
  if (!kind) return null;
  return { kind, urls: [...xml.matchAll(LOC_RE)].map((m) => m[1]!.trim()) };
}

export interface DoctorSummary {
  exitCode: 0 | 1;
  passed: string[];
  failed: string[];
  skipped: string[];
}

/**
 * Fold results into the exit posture: failures fail the run; skips never
 * count as green silently — they're surfaced by id so "doctor passed"
 * always names what did NOT run (fail-loud rule).
 */
export function summarize(results: CheckResult[]): DoctorSummary {
  const passed = results.filter((r) => r.status === 'pass').map((r) => r.id);
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.id);
  const skipped = results.filter((r) => r.status === 'skip').map((r) => r.id);
  return { exitCode: failed.length > 0 ? 1 : 0, passed, failed, skipped };
}
