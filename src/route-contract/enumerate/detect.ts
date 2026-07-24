/**
 * Marker-file framework detection. Specificity order (first match wins):
 * Explicit TanStack markers → Next → Astro → SvelteKit → Nuxt →
 * marker-less TanStack fallback → react-router candidates → null.
 *
 * The marker-less TanStack heuristic (any src/routes/*.tsx|jsx) runs LAST
 * among framework checks so a Next/Astro/SvelteKit/Nuxt repo with a stray
 * src/routes helper is never misclassified.
 */

import { normalizeListingPath } from './collect';
import { getReactRouterCandidatePaths } from './react-router';

import type { FrameworkId } from './types';

export function detectFramework(paths: string[]): FrameworkId | null {
  const normalized = paths.map(normalizeListingPath);

  // Explicit TanStack markers keep first place.
  if (hasExplicitTanStackMarkers(normalized)) return 'tanstack';
  if (isNext(normalized)) return 'next';
  if (isAstro(normalized)) return 'astro';
  if (isSvelteKit(normalized)) return 'sveltekit';
  if (isNuxt(normalized)) return 'nuxt';
  // Marker-less TanStack fallback — after all config-marker frameworks.
  if (hasMarkerlessTanStackRoutes(normalized)) return 'tanstack';
  if (getReactRouterCandidatePaths(normalized).length > 0) {
    return 'react-router';
  }
  return null;
}

function hasExplicitTanStackMarkers(paths: string[]): boolean {
  return paths.some(
    (p) =>
      p === 'src/routeTree.gen.ts' ||
      p === 'src/routeTree.gen.js' ||
      /^src\/routes\/__root\.[^/]+$/i.test(p),
  );
}

/**
 * Marker-less TanStack trees:
 * page files under src/routes that are not SvelteKit `+page` / `+layout`.
 * Must only win when no other framework config markers matched.
 */
function hasMarkerlessTanStackRoutes(paths: string[]): boolean {
  return paths.some((p) => {
    if (!/^src\/routes\/.+\.(tsx|jsx)$/i.test(p)) return false;
    if (p.endsWith('.d.ts')) return false;
    const base = p.split('/').pop() ?? '';
    // SvelteKit route modules start with `+`.
    if (base.startsWith('+')) return false;
    return true;
  });
}

function isNext(paths: string[]): boolean {
  const hasConfig = paths.some((p) => /^next\.config\.[^/]+$/i.test(p));
  if (!hasConfig) return false;
  return paths.some(
    (p) =>
      // App router page files
      /^(src\/)?app\/.*\/page\.(tsx|ts|jsx|js)$/i.test(p) ||
      /^(src\/)?app\/page\.(tsx|ts|jsx|js)$/i.test(p) ||
      // Pages router (exclude special _app/_document/_error and api)
      (/^(src\/)?pages\/.+\.(tsx|ts|jsx|js)$/i.test(p) &&
        !/\/api\//i.test(p) &&
        !/(?:^|\/)_(?:app|document|error)\./i.test(p)),
  );
}

function isAstro(paths: string[]): boolean {
  return paths.some((p) => /^astro\.config\.[^/]+$/i.test(p));
}

function isSvelteKit(paths: string[]): boolean {
  const hasConfig = paths.some((p) => /^svelte\.config\.[^/]+$/i.test(p));
  if (!hasConfig) return false;
  // Any +page* module (including load modules) signals a SvelteKit tree.
  return paths.some((p) => /(?:^|\/)\+page(?:@[^/]*)?\.[^/]+$/i.test(p));
}

function isNuxt(paths: string[]): boolean {
  return paths.some((p) => /^nuxt\.config\.[^/]+$/i.test(p));
}
