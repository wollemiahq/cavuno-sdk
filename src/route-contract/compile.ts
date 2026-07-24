import { classifyRoutes } from './classify';
import { ALL_ROLES, REQUIRED_ROLES, type RouteRole } from './roles';
import { checkRoleTemplate } from './validate';

import type { CompileResult, ManifestV1, RouteEntry } from './types';

const REQUIRED_SET: ReadonlySet<RouteRole> = new Set(REQUIRED_ROLES);

/**
 * Classify routes and emit a ManifestV1 plus publish-gate signals.
 * Assigned templates are self-validated via checkRoleTemplate;
 * failing required roles land in blockingMissing; failing optionals warn.
 */
export function compileManifest(
  routes: RouteEntry[],
  markers?: ReadonlyMap<string, RouteRole>,
): CompileResult {
  const { assignments, ambiguities, missingRequired } = classifyRoutes(
    routes,
    markers,
  );

  const roles: ManifestV1['roles'] = {};
  const warnings: string[] = [];
  const blocking = new Set<RouteRole>(missingRequired);

  for (const role of ALL_ROLES) {
    const entry = assignments[role];
    if (entry === undefined) continue;

    const templateErrors = checkRoleTemplate(role, entry.template);
    if (templateErrors.length > 0) {
      const exact = templateErrors.map((e) => e.message).join('; ');
      warnings.push(
        `role '${role}' template rejected: ${exact} — add export const cavunoPage = '${role}' on the correct page or fix the template`,
      );
      if (REQUIRED_SET.has(role)) {
        blocking.add(role);
      }
      continue;
    }

    roles[role] = entry.template;
  }

  // Ambiguity warnings for every ambiguous role.
  for (const amb of ambiguities) {
    const kind = REQUIRED_SET.has(amb.role) ? 'required' : 'optional';
    warnings.push(
      `${kind} role '${amb.role}' is ambiguous — add export const cavunoPage = '${amb.role}' to disambiguate`,
    );
  }

  // Unassigned optional roles (not ambiguous, not validation-dropped).
  for (const role of ALL_ROLES) {
    if (REQUIRED_SET.has(role)) continue;
    if (roles[role] !== undefined) continue;
    if (assignments[role] !== undefined) continue; // dropped by ; already warned
    if (ambiguities.some((a) => a.role === role)) continue;
    warnings.push(`optional role '${role}' is unassigned`);
  }

  return {
    manifest: { version: 1, roles },
    blockingMissing: REQUIRED_ROLES.filter((r) => blocking.has(r)),
    warnings,
    ambiguities,
  };
}
