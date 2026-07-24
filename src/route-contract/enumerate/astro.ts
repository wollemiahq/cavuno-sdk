/**
 * Astro file-based routing under src/pages/ (default) or pages/
 * when the tree has astro.config.* and no src/pages/ (srcDir-customized).
 * Page extensions: .astro / .md / .mdx / .html.
 * Skip _-prefixed and .../api/. Index collapses.
 * [param]→:param, [...slug]→*, [[...slug]]→*.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

const PAGE_EXT = /\.(astro|md|mdx|html)$/i;

export function parseAstroRoutes(paths: string[]): DerivedRoute[] {
  const normalized = paths.map(normalizeListingPath);
  const preferSrc = normalized.some((p) => p.startsWith('src/pages/'));
  return collectRoutes(
    normalized.map((p) => pathToRoute(p, preferSrc ? 'src/pages/' : null)),
  );
}

function pathToRoute(
  normalized: string,
  forcedRoot: string | null,
): DerivedRoute | null {
  const root = pagesRoot(normalized, forcedRoot);
  if (root === null) return null;
  if (!PAGE_EXT.test(normalized)) return null;

  const afterRoot = normalized.slice(root.length);
  if (afterRoot === 'api' || afterRoot.startsWith('api/')) return null;

  const rel = afterRoot.replace(PAGE_EXT, '');
  if (rel.length === 0) return null;

  const segments = rel.split('/').filter((s) => s.length > 0);
  const urlSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of segments) {
    if (seg.startsWith('_')) return null;
    if (seg === 'index') continue;

    if (seg.startsWith('[') && seg.endsWith(']')) {
      hasDynamic = true;
      // Optional catch-all `[[...slug]]` / optional `[[slug]]` — unwrap
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

  const path = urlSegments.length === 0 ? '/' : `/${urlSegments.join('/')}`;
  return { path, navigable: !hasDynamic, sourcePath: normalized };
}

/**
 * Default root is src/pages/. When forcedRoot is null (no src/pages/ in the
 * listing), accept pages/ as the pages root for srcDir-customized repos.
 */
function pagesRoot(
  normalized: string,
  forcedRoot: string | null,
): string | null {
  if (forcedRoot !== null) {
    return normalized.startsWith(forcedRoot) ? forcedRoot : null;
  }
  if (normalized.startsWith('src/pages/')) return 'src/pages/';
  if (normalized.startsWith('pages/')) return 'pages/';
  return null;
}
