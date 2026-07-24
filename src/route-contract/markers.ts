import { isRouteRole, type RouteRole } from './roles';

/**
 * Convert kebab-case token to camelCase (`job-detail` → `jobDetail`).
 * Tokens without hyphens are returned unchanged.
 */
function kebabToCamel(token: string): string {
  return token.replace(/-([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Tolerant parse of `export const cavunoPage = '<role>'` (single or double
 * quotes; optional `as const`). Accepts camelCase roles and their kebab-case
 * aliases (`job-detail` → `jobDetail`). Returns null when absent or when the
 * string is not a known RouteRole.
 */
export function extractCavunoPageMarker(contents: string): RouteRole | null {
  const re =
    /export\s+const\s+cavunoPage\s*=\s*(['"])([A-Za-z_][A-Za-z0-9_-]*)\1\s*(?:as\s+const)?\s*;?/;
  const match = re.exec(contents);
  if (!match) return null;
  const raw = match[2];
  if (raw === undefined) return null;

  if (isRouteRole(raw)) return raw;

  const camel = kebabToCamel(raw);
  if (isRouteRole(camel)) return camel;

  return null;
}
