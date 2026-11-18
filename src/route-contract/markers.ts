import { isRouteFeature, type RouteFeature } from './features';
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

/**
 * Tolerant parse of `export const cavunoFeatures = ['<feature>', ...]`
 * (single or double quotes; optional type annotation or `as const`). The
 * export must start its line, so a commented-out one does not count.
 * Returns the known features and the unknown names separately; an absent
 * marker yields both empty.
 */
export function extractCavunoFeaturesMarker(contents: string): {
  features: RouteFeature[];
  unknown: string[];
} {
  const match =
    /^[ \t]*export\s+const\s+cavunoFeatures\s*(?::[^=]*)?=\s*\[([^\]]*)\]/m.exec(
      contents,
    );
  const features: RouteFeature[] = [];
  const unknown: string[] = [];
  if (!match) return { features, unknown };
  for (const item of (match[1] ?? '').matchAll(/(['"])([^'"]*)\1/g)) {
    const name = item[2] ?? '';
    if (isRouteFeature(name)) features.push(name);
    else unknown.push(name);
  }
  return { features, unknown };
}
