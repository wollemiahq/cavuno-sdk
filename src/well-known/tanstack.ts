/**
 * TanStack route-tree → RouteEntry[] enumerator.
 *
 * board-sdk has NO runtime (or type) dependency on @tanstack/react-router.
 * The public documented Route shape we walk is structural:
 *
 *   {
 *     id?: string;          // e.g. '__root__', '/jobs/$slug'
 *     path?: string;        // relative segment, e.g. '$slug', 'jobs'
 *     fullPath?: string;    // absolute template, e.g. '/jobs/$slug'
 *     children?: Array | Record of the same shape
 *   }
 *
 * This matches the object exported by routeTree.gen.ts after
 * `_addFileChildren` / accepted by `createRouter({ routeTree })`.
 * Prefer `fullPath` when present; convert `$param` → `:param`, bare `$`
 * splat → `*`. Skip root + pathless/technical layout nodes (underscore
 * segments) while still walking their children.
 *
 * Research note (2026-07-22): TanStack `Route` exposes `id`, `path`,
 * `fullPath`, `children` on the instance (router-core Route interface).
 * `router.flatRoutes` / `routesById` require a live Router instance —
 * this helper deliberately walks the route *tree* so callers can pass
 * the generated routeTree without instantiating a router.
 */

import type { RouteEntry } from '../route-contract';

/**
 * Minimal structural type for a TanStack route-tree node.
 * Compatible with the public Route shape; no @tanstack imports.
 */
export type TanStackRouteNode = {
  id?: string;
  path?: string;
  fullPath?: string;
  children?:
    | readonly TanStackRouteNode[]
    | Readonly<Record<string, TanStackRouteNode>>;
};

/**
 * Walk a TanStack route tree into RouteEntry[] for the route-contract
 * compiler. Technical/pathless nodes are skipped; their descendants are
 * still visited.
 */
export function routeEntriesFromTanStackRouteTree(
  routeTree: TanStackRouteNode,
): RouteEntry[] {
  const out: RouteEntry[] = [];
  const seen = new Set<string>();

  function visit(node: TanStackRouteNode, isRoot: boolean): void {
    if (!isTechnicalNode(node, isRoot)) {
      const template = templateFromNode(node);
      if (template !== null && !seen.has(template)) {
        seen.add(template);
        out.push({ template });
      }
    }

    for (const child of childrenOf(node)) {
      visit(child, false);
    }
  }

  visit(routeTree, true);
  return out;
}

function childrenOf(node: TanStackRouteNode): TanStackRouteNode[] {
  const kids = node.children;
  if (kids === undefined || kids === null) return [];
  if (Array.isArray(kids)) return kids as TanStackRouteNode[];
  return Object.values(kids as Record<string, TanStackRouteNode>);
}

/**
 * Root and pathless/layout technical nodes are not pages. Pathless layouts
 * in TanStack use `_`-prefixed path/id segments (e.g. `_auth`); their
 * `fullPath` often still contains the underscore segment when read off the
 * tree before URL resolution — skip those templates.
 */
function isTechnicalNode(node: TanStackRouteNode, isRoot: boolean): boolean {
  if (isRoot) return true;
  const id = node.id ?? '';
  if (id === '__root__' || id === 'root') return true;

  // Pathless layout: path is empty, or path/id carries a `_` segment that
  // does not contribute to the public URL.
  const path = node.path ?? '';
  if (path === '' && !node.fullPath) return true;
  if (hasUnderscoreSegment(path) || hasUnderscoreSegment(id)) {
    // Still a technical layout when the fullPath itself is pathless-looking.
    const full = node.fullPath ?? '';
    if (full === '' || hasUnderscoreSegment(full)) return true;
    // id like `/_auth/alerts/manage` with fullPath `/alerts/manage` is a
    // real page nested under a pathless layout — keep it.
  }
  return false;
}

function hasUnderscoreSegment(value: string): boolean {
  if (!value) return false;
  return value.split('/').some((seg) => seg.startsWith('_') && seg.length > 1);
}

function templateFromNode(node: TanStackRouteNode): string | null {
  const raw =
    typeof node.fullPath === 'string' && node.fullPath.length > 0
      ? node.fullPath
      : typeof node.path === 'string' && node.path.length > 0
        ? node.path.startsWith('/')
          ? node.path
          : `/${node.path}`
        : null;

  if (raw === null) return null;
  // Underscore-only templates (pathless layout fullPath) are not pages.
  if (hasUnderscoreSegment(raw)) return null;

  return tanStackPathToUrlPattern(raw);
}

/**
 * Convert a TanStack path template to URLPattern `:param` / `*` form.
 *   `/jobs/$categorySlug` → `/jobs/:categorySlug`
 *   `/files/$`            → `/files/*`
 */
export function tanStackPathToUrlPattern(path: string): string {
  if (path === '/' || path === '') return '/';

  const segments = path.split('/');
  const converted = segments.map((seg) => {
    if (seg === '') return seg;
    if (seg === '$') return '*';
    // Optional params: `$param?` — strip trailing `?` on the name.
    if (seg.startsWith('$') && seg.endsWith('?')) {
      return `:${seg.slice(1, -1)}`;
    }
    if (seg.startsWith('$')) return `:${seg.slice(1)}`;
    return seg;
  });

  let result = converted.join('/');
  // Normalize double slashes that can appear from empty segments.
  result = result.replace(/\/{2,}/g, '/');
  if (!result.startsWith('/')) result = `/${result}`;
  // Trailing slash only for root.
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}
