import {
  ALL_ROLES,
  CANONICAL_MANIFEST,
  ROLE_PARAM_REGISTRY,
  type RouteRole,
} from '../route-contract/roles';
import { manifestRoleTemplate, record, type CheckResult } from './checks';
import { probeHop } from './probe';

/**
 *a board that translates its fixed URL words serves each page at
 * its own word, and the English form of every such page 308s there.
 *
 * Which pages are translated comes from the board's route manifest
 * (`/.well-known/cavuno.json`, read once by the read tier). Roles are
 * classified on the English route tree, and a static role only classifies
 * at its canonical path, so the English form of a static role is its
 * canonical template. The manifest then publishes that template with each
 * fixed segment mapped to the board's word. A static role whose published
 * template differs from the canonical one, segment for segment, is a
 * translated page. Roles with params are skipped (no static URL to request),
 * and so is `home` (`/` has no words). Machine paths are not roles.
 *
 * Two requests per translated role, redirects not followed:
 * 1. the English path answers 308 with `Location` on the same origin at
 *    exactly the published template;
 * 2. the published template answers 2xx. Pages that read a token or a
 *    session ({@link REDIRECT_OK}) may instead redirect within the board.
 *    Pages a board can leave unpublished ({@link MAY_BE_UNPUBLISHED}) may
 *    answer 404. A redirect to the board's password or coming-soon gate,
 *    or off the board's origin, never counts.
 */
export const LOCALIZED_URLS = record('read.localizedUrls', 2);

/** Token or session pages: a same-origin redirect (e.g. to sign-in) is fine. */
const REDIRECT_OK: ReadonlySet<RouteRole> = new Set([
  'employers',
  'alertsManage',
  'alertsConfirm',
  'mePurchases',
]);

/**
 * Pages that 404 by design when the board has not published them: a board
 * can switch its blog off, leave its about page empty, keep its talent
 * directory private or publish no legal pages.
 */
const MAY_BE_UNPUBLISHED: ReadonlySet<RouteRole> = new Set([
  'blog',
  'about',
  'talent',
  'privacyPolicy',
  'termsOfService',
  'cookiePolicy',
  'impressum',
]);

/** The board's access gates: a redirect there means the page was not served. */
const GATE_SEGMENTS: ReadonlySet<string> = new Set([
  'password',
  'coming-soon-gate',
]);

/**
 * One request at a time, like every other read probe: a candidate is one
 * isolate, and concurrent renders there queue and 5xx the later requests.
 */
const CONCURRENCY = 1;

export interface TranslatedRole {
  role: RouteRole;
  /** The canonical English path. */
  english: string;
  /** The path the board publishes in its own words. */
  localized: string;
}

const segments = (path: string) => path.split('/').filter(Boolean);

/** Static roles the manifest publishes under translated words. */
export function translatedStaticRoles(manifest: unknown): TranslatedRole[] {
  const translated: TranslatedRole[] = [];
  for (const role of ALL_ROLES) {
    if (ROLE_PARAM_REGISTRY[role].length > 0 || role === 'home') continue;
    const english = CANONICAL_MANIFEST.roles[role];
    const localized = manifestRoleTemplate(manifest, role);
    if (!english || !localized || localized === english) continue;
    // Words translate one segment at a time; a different shape is a
    // renamed route, not a translation, and has no English redirect.
    if (segments(localized).length !== segments(english).length) continue;
    translated.push({ role, english, localized });
  }
  return translated;
}

/** `Location` resolved against the request, or null when unparseable. */
function resolveLocation(location: string, requestUrl: string): URL | null {
  try {
    return new URL(location, requestUrl);
  } catch {
    return null;
  }
}

/** Path of `url` under the frontend base, for messages and comparisons. */
function pathUnder(base: URL, url: URL): string {
  const prefix = base.pathname.replace(/\/$/, '');
  const path =
    prefix && url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length) || '/'
      : url.pathname;
  return `${path}${url.search}`;
}

/**
 * The password or coming-soon gate: its English segment, or — since the
 * gate's own word may be translated too — a one-segment page that takes
 * `?redirect=` back to the page requested (sign-in lives under `/auth/`).
 */
function isGate(base: URL, url: URL, requested: string): boolean {
  const parts = segments(pathUnder(base, url).split('?')[0]!);
  const last = parts.at(-1);
  if (last !== undefined && GATE_SEGMENTS.has(last)) return true;
  return parts.length === 1 && url.searchParams.get('redirect') === requested;
}

async function checkRole(
  fetchImpl: typeof fetch,
  baseUrl: string,
  { role, english, localized }: TranslatedRole,
): Promise<string | null> {
  const base = new URL(baseUrl);
  const problems: string[] = [];

  const englishUrl = `${baseUrl}${english}`;
  const hop = await probeHop(fetchImpl, englishUrl);
  const target =
    hop.location === null ? null : resolveLocation(hop.location, englishUrl);
  if (hop.status !== 308) {
    problems.push(
      `${english} → HTTP ${hop.status}${hop.error ? ` (${hop.error})` : ''}${target ? ` to ${target.href}` : ''}, expected 308 to ${localized}`,
    );
  } else if (target === null) {
    problems.push(
      `${english} → 308 without a usable Location, expected ${localized}`,
    );
  } else if (target.origin !== base.origin) {
    problems.push(
      `${english} → 308 off the board's origin to ${target.href}, expected ${localized}`,
    );
  } else if (pathUnder(base, target) !== localized) {
    problems.push(
      `${english} → 308 to ${pathUnder(base, target)}, expected ${localized}`,
    );
  }

  const pageUrl = `${baseUrl}${localized}`;
  const page = await probeHop(fetchImpl, pageUrl);
  const pageTarget =
    page.location === null ? null : resolveLocation(page.location, pageUrl);
  const ok2xx = page.status >= 200 && page.status < 300;
  const redirected = page.status >= 300 && page.status < 400;
  if (ok2xx) {
    // served
  } else if (page.status === 404 && MAY_BE_UNPUBLISHED.has(role)) {
    // not published on this board; the 308 above still proves the word
  } else if (redirected && pageTarget === null) {
    problems.push(
      `${localized} → HTTP ${page.status} without a usable Location, expected 2xx`,
    );
  } else if (redirected && pageTarget!.origin !== base.origin) {
    problems.push(
      `${localized} → HTTP ${page.status} off the board's origin to ${pageTarget!.href}, expected 2xx`,
    );
  } else if (redirected && isGate(base, pageTarget!, localized)) {
    problems.push(
      `${localized} → HTTP ${page.status} to the board's access gate ${pathUnder(base, pageTarget!)}, expected 2xx`,
    );
  } else if (!(redirected && REDIRECT_OK.has(role))) {
    problems.push(
      `${localized} → HTTP ${page.status}${page.error ? ` (${page.error})` : ''}${pageTarget ? ` to ${pathUnder(base, pageTarget)}` : ''}, expected 2xx`,
    );
  }

  return problems.length > 0 ? `${role}: ${problems.join('; ')}` : null;
}

/**
 * Run the check for a manifest the read tier already fetched (`null` when
 * it was missing or unreadable). Not applicable — and no requests — when
 * the board publishes no translated words.
 */
export async function probeLocalizedUrls(
  fetchImpl: typeof fetch,
  base: string,
  manifest: unknown,
): Promise<CheckResult> {
  if (manifest === null) {
    return LOCALIZED_URLS(
      'skip',
      'not applicable — no readable route manifest at /.well-known/cavuno.json',
    );
  }
  const roles = translatedStaticRoles(manifest);
  if (roles.length === 0) {
    return LOCALIZED_URLS(
      'skip',
      'not applicable — the route manifest publishes no translated URL words',
    );
  }

  const failures: (string | null)[] = new Array(roles.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < roles.length) {
      const index = next++;
      failures[index] = await checkRole(fetchImpl, base, roles[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, roles.length) }, worker),
  );

  const failed = failures.filter((f): f is string => f !== null);
  if (failed.length > 0) {
    return LOCALIZED_URLS('fail', failed.join(' | '));
  }
  return LOCALIZED_URLS(
    'pass',
    `${roles.length} translated pages: each English path 308s to the board's word and the page answers (${roles.map((r) => `${r.english} → ${r.localized}`).join(', ')})`,
  );
}
