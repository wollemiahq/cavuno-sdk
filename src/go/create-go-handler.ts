/**
 * Pure `/go` indirection for self-deployed SDK boards.
 *
 * Mirrors the hosted-app contract:
 * - `/go/job/<id>` → 302 to jobDetailPath(companySlug, jobSlug)
 * - `/go/alerts-manage` / `/go/alerts-confirm` → 302 carrying query
 * - unknown / unresolvable → 302 to BOARD_PATHS.jobs
 * - every response: `X-Robots-Tag: noindex, nofollow`
 *
 * Framework-portable: takes a standard Request, returns a standard
 * Response. No Next.js imports (same discipline as the sitemap walker).
 */

import { BOARD_PATHS, jobDetailPath } from '../paths';

export interface ResolvedJobSlugs {
  companySlug: string;
  jobSlug: string;
}

export interface GoRedirectResult {
  location: string;
  status: 302;
}

/**
 * Optional job-id → slugs lookup. The public Board API currently exposes
 * job retrieve **by slug only** (`board.jobs.retrieve(jobSlug)`); there is
 * no publishable-key endpoint that resolves an immutable job id to slugs.
 *
 * When `lookupJob` is omitted, `/go/job/<id>` degrades to the jobs index
 * (safe, never 404). Pass a custom lookup when a data-plane endpoint lands
 * (see TODO).
 */
export type GoJobLookup = (
  jobId: string,
) => Promise<ResolvedJobSlugs | null> | ResolvedJobSlugs | null;

export interface CreateGoHandlerConfig {
  /**
   * Optional job resolver. Injected so tests can fake the data client and
   * so callers can wire a future Board API id-lookup without an SDK release.
   */
  lookupJob?: GoJobLookup;
  /**
   * Base origin used to absolutize Location (e.g. `https://jobs.example.com`).
   * When omitted, Location is absolute against the incoming request URL —
   * correct for same-host mounts.
   */
  origin?: string;
}

const NOINDEX_ROBOTS = 'noindex, nofollow';

export function goResponseHeaders(): Record<string, string> {
  return {
    'X-Robots-Tag': NOINDEX_ROBOTS,
    'Cache-Control': 'private, no-store',
  };
}

/**
 * Pure role → location resolver. Shared by the handler so unit tests can
 * assert the contract without spinning a Request.
 */
export function resolveGoRedirect(
  parts: readonly string[] | undefined,
  search: string,
  resolvedJob: ResolvedJobSlugs | null,
): GoRedirectResult {
  const role = parts?.[0];
  const id = parts?.[1];

  const query = search.startsWith('?') ? search : search ? `?${search}` : '';

  if (role === 'job') {
    if (id && resolvedJob?.companySlug && resolvedJob.jobSlug) {
      return {
        location: jobDetailPath(resolvedJob.companySlug, resolvedJob.jobSlug),
        status: 302,
      };
    }
    return { location: BOARD_PATHS.jobs, status: 302 };
  }

  if (role === 'alerts-manage') {
    return {
      location: `${BOARD_PATHS.alertsManage}${query}`,
      status: 302,
    };
  }

  if (role === 'alerts-confirm') {
    return {
      location: `${BOARD_PATHS.alertsConfirm}${query}`,
      status: 302,
    };
  }

  return { location: BOARD_PATHS.jobs, status: 302 };
}

/**
 * Extract `/go` path segments from a request URL.
 *
 * Match the first **exact** path segment `go` (segment boundary), not a
 * substring. `/google` must not match; `/docs/go/job/x` parses after `go`.
 * When no exact `go` segment is present, treat the full path as a catch-all
 * remainder (frameworks that strip the mount prefix pass `job/x` only).
 */
function partsFromRequest(request: Request): string[] {
  const { pathname } = new URL(request.url);
  const segments = pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const goIdx = segments.findIndex((s) => s === 'go');
  if (goIdx >= 0) {
    return segments.slice(goIdx + 1);
  }
  return segments;
}

/**
 * Create a `(request) => Response` handler the starter mounts at `/go/*`.
 *
 * @example
 * // Next.js App Router
 * import { createGoHandler } from '@cavuno/board/go';
 * export const GET = createGoHandler({});
 *
 * // With a future id-lookup:
 * export const GET = createGoHandler({
 *   lookupJob: async (id) => board.jobs.retrieveById?.(id) ?? null,
 * });
 */
export function createGoHandler(config: CreateGoHandlerConfig = {}) {
  const { lookupJob, origin } = config;

  return async function goHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = partsFromRequest(request);

    let resolvedJob: ResolvedJobSlugs | null = null;

    if (parts[0] === 'job' && parts[1]) {
      if (lookupJob) {
        try {
          resolvedJob = (await lookupJob(parts[1])) ?? null;
        } catch {
          resolvedJob = null;
        }
      } else {
        // TODO: Board API has no publishable-key job-by-id
        // endpoint (`jobs.retrieve` is slug-only). Until one exists, job
        // resolution degrades to the jobs index — safe, never 404, never
        // leaks. Do NOT invent an endpoint here.
        resolvedJob = null;
      }
    }

    const result = resolveGoRedirect(parts, url.search, resolvedJob);
    const locationBase = origin ?? url.origin;
    return new Response(null, {
      status: result.status,
      headers: {
        ...goResponseHeaders(),
        Location: new URL(result.location, locationBase).toString(),
      },
    });
  };
}
