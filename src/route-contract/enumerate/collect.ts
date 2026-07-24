/**
 * Shared dedupe + sort for derived route lists.
 * Prefer navigable when the same path is contributed twice.
 * Preserve the first sourcePath for marker harvest.
 */

import type { DerivedRoute } from './types';

export function collectRoutes(
  routes: Array<DerivedRoute | null>,
): DerivedRoute[] {
  const byPath = new Map<
    string,
    { navigable: boolean; sourcePath: string | undefined }
  >();

  for (const derived of routes) {
    if (derived === null) continue;
    const existing = byPath.get(derived.path);
    if (existing === undefined) {
      byPath.set(derived.path, {
        navigable: derived.navigable,
        sourcePath: derived.sourcePath,
      });
    } else {
      byPath.set(derived.path, {
        navigable: existing.navigable || derived.navigable,
        sourcePath: existing.sourcePath ?? derived.sourcePath,
      });
    }
  }

  return [...byPath.entries()]
    .map(([path, meta]) => {
      const route: DerivedRoute = { path, navigable: meta.navigable };
      if (meta.sourcePath !== undefined) {
        route.sourcePath = meta.sourcePath;
      }
      return route;
    })
    .sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
}

export function normalizeListingPath(filePath: string): string {
  return filePath.replace(/^\.\//, '');
}
