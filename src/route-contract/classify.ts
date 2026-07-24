import { extractParamNames, paramSetKey, sameParamSet } from './params';
import {
  ALL_ROLES,
  CANONICAL_MANIFEST,
  REQUIRED_ROLES,
  ROLE_PARAM_REGISTRY,
  type RouteRole,
} from './roles';

import type { Ambiguity, ClassifyResult, RouteEntry } from './types';

/** How many roles share a given non-empty param signature. */
const SHARED_SIGNATURE_COUNTS: ReadonlyMap<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const role of ALL_ROLES) {
    const params = ROLE_PARAM_REGISTRY[role];
    if (params.length === 0) continue;
    const key = paramSetKey(params);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
})();

/**
 * Whether `route` is a param-signature (or static exact-match) candidate
 * for `role`. Empty-param roles never infer by signature — only exact
 * template match against CANONICAL_MANIFEST (or a marker, applied upstream).
 *
 * Roles that share a param set (e.g. company / companySalary both use
 * `{companySlug}`) only auto-match their canonical template; renames of
 * those roles need a marker. Unique signatures (jobDetail) match any
 * directories.
 */
function isSignatureCandidate(route: RouteEntry, role: RouteRole): boolean {
  const registry = ROLE_PARAM_REGISTRY[role];
  const routeParams = extractParamNames(route.template);

  if (registry.length === 0) {
    // Statics + alerts: exact template only.
    return route.template === CANONICAL_MANIFEST.roles[role];
  }

  if (!sameParamSet(routeParams, registry)) return false;

  const shareCount = SHARED_SIGNATURE_COUNTS.get(paramSetKey(registry)) ?? 0;
  if (shareCount > 1) {
    // Shared signature → only the identity template auto-matches.
    return route.template === CANONICAL_MANIFEST.roles[role];
  }

  return true;
}

/**
 * Classify routes into role assignments. Markers (keyed by `sourcePath`)
 * always win and remove the route from inference. Two markers claiming the
 * same role is an ambiguity (never silent first-wins). Ambiguities never
 * guess.
 */
export function classifyRoutes(
  routes: RouteEntry[],
  markers?: ReadonlyMap<string, RouteRole>,
): ClassifyResult {
  const assignments: Partial<Record<RouteRole, RouteEntry>> = {};
  const ambiguities: Ambiguity[] = [];
  const claimed = new Set<RouteEntry>();

  // 1. Markers — group by role; 2+ claims → ambiguity.
  if (markers && markers.size > 0) {
    const claimsByRole = new Map<RouteRole, RouteEntry[]>();

    for (const route of routes) {
      if (route.sourcePath === undefined) continue;
      const role = markers.get(route.sourcePath);
      if (role === undefined) continue;
      const list = claimsByRole.get(role);
      if (list) list.push(route);
      else claimsByRole.set(role, [route]);
    }

    for (const [role, candidates] of claimsByRole) {
      // Marked routes leave the inference pool regardless of outcome.
      for (const c of candidates) claimed.add(c);

      if (candidates.length === 1) {
        assignments[role] = candidates[0]!;
      } else {
        ambiguities.push({ role, candidates: [...candidates] });
      }
    }
  }

  // 2. Inference for unassigned roles over unclaimed routes.
  const pool = routes.filter((r) => !claimed.has(r));

  for (const role of ALL_ROLES) {
    if (assignments[role] !== undefined) continue;
    // Role already ambiguous via dual markers — do not re-infer.
    if (ambiguities.some((a) => a.role === role)) continue;

    const candidates = pool.filter((r) => isSignatureCandidate(r, role));

    if (candidates.length === 0) continue;

    if (candidates.length === 1) {
      const only = candidates[0]!;
      // A route must not be double-assigned to two roles.
      if (claimed.has(only)) {
        continue;
      }
      assignments[role] = only;
      claimed.add(only);
      continue;
    }

    // Two+ candidates → ambiguity, role unassigned.
    ambiguities.push({ role, candidates: [...candidates] });
  }

  const missingRequired = REQUIRED_ROLES.filter(
    (role) => assignments[role] === undefined,
  );

  return { assignments, ambiguities, missingRequired };
}
