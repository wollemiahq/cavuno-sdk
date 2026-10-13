/**
 * Doctor check primitives: the pure logic behind
 * `npx @cavuno/board doctor` — env validation, JSON-LD extraction,
 * sitemap parsing, and the pass/fail/skip summary. Everything here is
 * synchronous and I/O-free so it unit-tests without a network; the
 * orchestrator in run.ts owns the fetches.
 */

import { matchPathToTemplate } from '../route-contract/match-history';
import { CANONICAL_MANIFEST, type RouteRole } from '../route-contract/roles';
import { checkRoleTemplate } from '../route-contract/validate';

export type CheckStatus = 'pass' | 'fail' | 'skip' | 'warn';

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

/**
 * With `templates`, returns the first root-relative link whose path matches
 * any of them segment for segment (each `:param` one slug segment), so a
 * board that translates its URL words is checked against its own routes.
 */
export function extractJobDetailLink(
  html: string,
  templates?: readonly string[],
): string | null {
  if (!templates) return html.match(JOB_DETAIL_LINK_RE)?.[1] ?? null;
  for (const match of html.matchAll(HREF_PATH_RE)) {
    const path = match[1]!;
    if (path.endsWith('/')) continue;
    for (const template of templates) {
      const params = matchPathToTemplate(template, path);
      if (params && Object.values(params).every((v) => SLUG_RE.test(v))) {
        return path;
      }
    }
  }
  return null;
}

const HREF_PATH_RE = /href="(\/[^"?#\s]+)"/gi;
const SLUG_RE = /^[a-z0-9-]+$/i;

/** The canonical English job detail template every board has always served. */
export const CANONICAL_JOB_DETAIL_TEMPLATE =
  CANONICAL_MANIFEST.roles.jobDetail!;

/**
 * A role's template from a parsed route manifest, or null when the
 * manifest is not a v1 document or the template is missing or invalid.
 */
export function manifestRoleTemplate(
  manifest: unknown,
  name: RouteRole,
): string | null {
  const roles =
    manifest !== null &&
    typeof manifest === 'object' &&
    (manifest as { version?: unknown }).version === 1
      ? (manifest as { roles?: unknown }).roles
      : null;
  const template =
    roles !== null && typeof roles === 'object'
      ? (roles as Record<string, unknown>)[name]
      : undefined;
  return typeof template === 'string' &&
    checkRoleTemplate(name, template).length === 0
    ? template
    : null;
}

export interface JobRoutes {
  /** Path of the jobs listing page. */
  jobsPath: string;
  /** Detail templates to accept, board's own first; always includes the canonical English one. */
  jobDetailTemplates: string[];
}

/**
 * Job routes from a board's published route manifest
 * (`/.well-known/cavuno.json`). The detail template is `roles.jobDetail`
 * when present, else derived as `roles.company` + the jobs listing word +
 * `/:jobSlug` (fixed URL words are translated per word, so the listing word
 * reappears inside the detail path). Anything missing or invalid falls back
 * to the canonical English routes.
 */
export function jobRoutesFromManifest(manifest: unknown): JobRoutes {
  const role = (name: RouteRole) => manifestRoleTemplate(manifest, name);

  const jobs = role('jobs');
  const company = role('company');
  const jobsWord = jobs
    ?.split('/')
    .filter((seg) => seg !== '' && !seg.includes(':'))
    .at(-1);
  const derived =
    company && jobsWord ? `${company}/${jobsWord}/:jobSlug` : null;
  const detail =
    role('jobDetail') ??
    (derived && checkRoleTemplate('jobDetail', derived).length === 0
      ? derived
      : null);

  return {
    jobsPath: jobs ?? '/jobs',
    jobDetailTemplates:
      detail && detail !== CANONICAL_JOB_DETAIL_TEMPLATE
        ? [detail, CANONICAL_JOB_DETAIL_TEMPLATE]
        : [CANONICAL_JOB_DETAIL_TEMPLATE],
  };
}

/** `/companies/:companySlug/jobs/:jobSlug` reads as `/companies/{c}/jobs/{s}`. */
export function describeJobDetailTemplate(template: string): string {
  return template
    .replace(':companySlug', '{c}')
    .replace(':jobSlug', '{s}')
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
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
  /** Clone leftovers and similar — counted separately; does not fail the run. */
  warned: string[];
}

/**
 * Fold results into the exit posture: failures fail the run; skips never
 * count as green silently — they're surfaced by id so "doctor passed"
 * always names what did NOT run (fail-loud rule). Warnings are additive
 * and do not change the exit code.
 */
export function summarize(results: CheckResult[]): DoctorSummary {
  const passed = results.filter((r) => r.status === 'pass').map((r) => r.id);
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.id);
  const skipped = results.filter((r) => r.status === 'skip').map((r) => r.id);
  const warned = results.filter((r) => r.status === 'warn').map((r) => r.id);
  return {
    exitCode: failed.length > 0 ? 1 : 0,
    passed,
    failed,
    skipped,
    warned,
  };
}
