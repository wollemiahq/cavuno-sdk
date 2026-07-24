/**
 * SvelteKit file-based routing: src/routes/.../+page.svelte
 * and layout-reset +page@*.svelte only.
 * (group) stripped, [param]→:param, [[...rest]]→*, dynamic ⇒ navigable false.
 * +page.ts / +page.server.ts are load modules and derive nothing.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

const ROUTES_PREFIX = 'src/routes/';
// Pages only: +page.svelte or +page@<layout>.svelte (layout reset).
// +page.ts / +page.server.ts / +page.js are load modules — never pages.
const ROOT_PAGE = /^\+page(?:@[^/]*)?\.svelte$/i;
const NESTED_PAGE = /\/\+page(?:@[^/]*)?\.svelte$/i;

export function parseSvelteKitRoutes(paths: string[]): DerivedRoute[] {
  return collectRoutes(paths.map(pathToRoute));
}

function pathToRoute(filePath: string): DerivedRoute | null {
  const normalized = normalizeListingPath(filePath);
  if (!normalized.startsWith(ROUTES_PREFIX)) return null;

  const afterRoot = normalized.slice(ROUTES_PREFIX.length);
  let rel: string;
  if (ROOT_PAGE.test(afterRoot)) {
    rel = '';
  } else if (NESTED_PAGE.test(afterRoot)) {
    rel = afterRoot.replace(NESTED_PAGE, '');
  } else {
    return null;
  }

  const segments = rel.length === 0 ? [] : rel.split('/');
  const urlSegments: string[] = [];
  let hasDynamic = false;

  for (const seg of segments) {
    if (seg.length === 0) continue;
    // Pathless groups: strip from URL.
    if (seg.startsWith('(') && seg.endsWith(')')) continue;
    // Private modules.
    if (seg.startsWith('_')) return null;

    if (seg.startsWith('[') && seg.endsWith(']')) {
      hasDynamic = true;
      // Optional catch-all `[[...path]]` / optional `[[slug]]` — unwrap
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
