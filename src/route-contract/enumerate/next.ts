/**
 * Next.js app router + pages router parsers over a path listing.
 *
 * App: app/.../page.* (+ src/app), strip (group) and @slot,
 * [param]→:param, [...slug]→*, skip app/api/... and _private.
 *
 * Pages: pages/... (+ src/pages), skip api + _app/_document/_error,
 * index collapses, [param]→:param.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

const APP_PAGE_FILE = /(?:^|\/)page\.(tsx|ts|jsx|js)$/i;
const PAGES_EXT = /\.(tsx|ts|jsx|js)$/i;
const PAGES_SPECIAL = /(?:^|\/)_(?:app|document|error)\.[^/]+$/i;

export function parseNextRoutes(paths: string[]): DerivedRoute[] {
  return collectRoutes([
    ...paths.map(pathToAppRoute),
    ...paths.map(pathToPagesRoute),
  ]);
}

function pathToAppRoute(filePath: string): DerivedRoute | null {
  const normalized = normalizeListingPath(filePath);
  const root = appRoot(normalized);
  if (root === null) return null;
  if (!APP_PAGE_FILE.test(normalized)) return null;

  // Strip to relative segments under app/ or src/app/.
  // Root page is just `page.tsx` → rel ''; nested is `about/page.tsx` → `about`.
  const afterRoot = normalized.slice(root.length);
  const rel = afterRoot.replace(/(?:^|\/)page\.(tsx|ts|jsx|js)$/i, '');
  // rel is '' for root page, or 'about', 'blog/[slug]', etc. (no leading /)
  const segments = rel.length === 0 ? [] : rel.split('/');

  const urlSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of segments) {
    if (seg.length === 0) continue;
    // Private folders: skip the whole route.
    if (seg.startsWith('_')) return null;
    // Parallel route slots: strip like groups.
    if (seg.startsWith('@')) continue;
    // Intercepting routes are NOT standalone pages: any segment with
    // (.) / (..) / (...) (1–3+ dots, including chained '(..)(..)') → null.
    // Must run before the route-group check (which also matches parens).
    if (isInterceptingSegment(seg)) return null;
    // Route groups: strip from URL.
    if (seg.startsWith('(') && seg.endsWith(')')) continue;

    if (seg.startsWith('[') && seg.endsWith(']')) {
      hasDynamic = true;
      // `[[...slug]]` (optional catch-all) unwraps to `[...slug]` — strip
      // the second bracket layer before the rest-marker check.
      let inner = seg.slice(1, -1);
      if (inner.startsWith('[') && inner.endsWith(']')) {
        inner = inner.slice(1, -1);
      }
      if (inner.startsWith('...')) {
        urlSegments.push('*');
      } else {
        urlSegments.push(`:${inner}`);
      }
      continue;
    }
    urlSegments.push(seg);
  }

  // Skip api routes: any remaining segment path that started under api/
  // is already filtered if the file was under app/api — but groups could
  // wrap api, so also reject if first concrete segment is 'api'.
  const path = urlSegments.length === 0 ? '/' : `/${urlSegments.join('/')}`;
  if (path === '/api' || path.startsWith('/api/')) return null;

  return { path, navigable: !hasDynamic, sourcePath: normalized };
}

/**
 * Next intercepting-route segment: starts with one or more `(.)` / `(..)` /
 * `(...)` groups (1–3+ dots each). Includes chained forms like `(..)(..)`.
 * These soft-navigate overlays are not standalone navigator pages.
 */
function isInterceptingSegment(seg: string): boolean {
  return /^\(\.{1,}\)(\(\.{1,}\))*/.test(seg);
}

function appRoot(normalized: string): string | null {
  if (normalized.startsWith('src/app/')) return 'src/app/';
  if (normalized.startsWith('app/')) return 'app/';
  return null;
}

function pathToPagesRoute(filePath: string): DerivedRoute | null {
  const normalized = normalizeListingPath(filePath);
  const root = pagesRoot(normalized);
  if (root === null) return null;
  if (!PAGES_EXT.test(normalized)) return null;
  if (normalized.endsWith('.d.ts')) return null;

  const afterRoot = normalized.slice(root.length);
  // Skip pages/api/**
  if (afterRoot === 'api' || afterRoot.startsWith('api/')) return null;
  // Skip _app, _document, _error (anywhere under pages).
  if (PAGES_SPECIAL.test(afterRoot)) return null;

  const rel = afterRoot.replace(PAGES_EXT, '');
  if (rel.length === 0) return null;

  const segments = rel.split('/').filter((s) => s.length > 0);
  const urlSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of segments) {
    if (seg.startsWith('_')) return null;
    if (seg === 'index') continue;

    if (seg.startsWith('[') && seg.endsWith(']')) {
      hasDynamic = true;
      // `[[...slug]]` optional catch-all — strip the second bracket layer.
      let inner = seg.slice(1, -1);
      if (inner.startsWith('[') && inner.endsWith(']')) {
        inner = inner.slice(1, -1);
      }
      if (inner.startsWith('...')) {
        urlSegments.push('*');
      } else {
        urlSegments.push(`:${inner}`);
      }
      continue;
    }
    urlSegments.push(seg);
  }

  const path = urlSegments.length === 0 ? '/' : `/${urlSegments.join('/')}`;
  return { path, navigable: !hasDynamic, sourcePath: normalized };
}

function pagesRoot(normalized: string): string | null {
  if (normalized.startsWith('src/pages/')) return 'src/pages/';
  if (normalized.startsWith('pages/')) return 'pages/';
  return null;
}
