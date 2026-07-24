/**
 *  — framework adapter registry entry.
 *
 * Detects the framework from a path listing, dispatches to the matching
 * pure parser, returns DerivedRoute[] (path + navigable). Unknown → [].
 *
 * react-router content parsers are exported for later UI wiring; the
 * path-only deriveRoutes entry returns [] for react-router-only trees.
 *
 *enumerateRouteEntries keeps sourcePath for marker harvest +
 * compileManifest; deriveRoutes strips it so the navigator contract is
 * unchanged (path + navigable only).
 */

import { parseAstroRoutes } from './astro';
import { detectFramework } from './detect';
import { parseNextRoutes } from './next';
import { parseNuxtRoutes } from './nuxt';
import { parseSvelteKitRoutes } from './sveltekit';
import { parseTanStackRoutes } from './tanstack';

import type { RouteEntry } from '../types';
import type { DerivedRoute } from './types';

export type { DerivedRoute, FrameworkId } from './types';
export { detectFramework } from './detect';
export {
  getReactRouterCandidatePaths,
  parseReactRouterRoutes,
} from './react-router';
export { parseTanStackRoutes } from './tanstack';
export { parseNextRoutes } from './next';
export { parseAstroRoutes } from './astro';
export { parseSvelteKitRoutes } from './sveltekit';
export { parseNuxtRoutes } from './nuxt';

function enumerateDerived(paths: string[]): DerivedRoute[] {
  const framework = detectFramework(paths);
  if (framework === null) return [];

  switch (framework) {
    case 'tanstack':
      return parseTanStackRoutes(paths);
    case 'next':
      return parseNextRoutes(paths);
    case 'astro':
      return parseAstroRoutes(paths);
    case 'sveltekit':
      return parseSvelteKitRoutes(paths);
    case 'nuxt':
      return parseNuxtRoutes(paths);
    case 'react-router':
      // Content-fetch not supported; path listing alone cannot parse RR.
      return [];
    default: {
      const _exhaustive: never = framework;
      return _exhaustive;
    }
  }
}

/**
 * Navigator contract: path + navigable only.
 * sourcePath is intentionally stripped so existing equality fixtures hold.
 */
export function deriveRoutes(paths: string[]): DerivedRoute[] {
  return enumerateDerived(paths).map(({ path, navigable }) => ({
    path,
    navigable,
  }));
}

/**
 *  compile path: URL template + sourcePath for marker harvest.
 */
export function enumerateRouteEntries(paths: string[]): RouteEntry[] {
  return enumerateDerived(paths).map(({ path, sourcePath }) => {
    const entry: RouteEntry = { template: path };
    if (sourcePath !== undefined) entry.sourcePath = sourcePath;
    return entry;
  });
}
