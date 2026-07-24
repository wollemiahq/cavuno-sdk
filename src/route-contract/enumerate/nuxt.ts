/**
 * Nuxt file-based routing under pages/ (and src/pages/).
 * [param]→:param, [[...slug]]→*, [[slug]]→:slug, index collapses.
 * Dynamic ⇒ navigable false.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

const PAGE_EXT = /\.(vue|tsx|ts|jsx|js)$/i;

export function parseNuxtRoutes(paths: string[]): DerivedRoute[] {
  return collectRoutes(paths.map(pathToRoute));
}

function pathToRoute(filePath: string): DerivedRoute | null {
  const normalized = normalizeListingPath(filePath);
  const root = pagesRoot(normalized);
  if (root === null) return null;
  if (!PAGE_EXT.test(normalized)) return null;
  if (normalized.endsWith('.d.ts')) return null;

  const afterRoot = normalized.slice(root.length);
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

function pagesRoot(normalized: string): string | null {
  if (normalized.startsWith('src/pages/')) return 'src/pages/';
  if (normalized.startsWith('pages/')) return 'pages/';
  return null;
}
