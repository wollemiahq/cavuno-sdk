/**
 * react-router pure parsers over provided FILE CONTENTS.
 *
 * Content-fetch is intentionally not supported into the navigator UI —
 *  only exposes these functions; UI wiring is a future release.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

/**
 * Candidate source files that typically declare react-router routes.
 * Matches App.* / *routes*.* / router.* (basename-based).
 */
export function getReactRouterCandidatePaths(paths: string[]): string[] {
  const candidates: string[] = [];
  for (const raw of paths) {
    const p = normalizeListingPath(raw);
    const base = p.split('/').pop() ?? p;
    const lower = base.toLowerCase();
    // App.tsx / App.jsx / App.ts / App.js
    if (/^app\.(tsx|ts|jsx|js)$/i.test(base)) {
      candidates.push(p);
      continue;
    }
    // router.tsx etc.
    if (/^router\.(tsx|ts|jsx|js)$/i.test(base)) {
      candidates.push(p);
      continue;
    }
    // *routes* — routes.tsx, app-routes.ts, Routes.jsx, …
    if (
      lower.includes('routes') &&
      /\.(tsx|ts|jsx|js)$/i.test(base) &&
      !base.endsWith('.d.ts')
    ) {
      candidates.push(p);
    }
  }
  return candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Extract routes from react-router source contents via tolerant regex.
 * Supports `<Route path="...">` and `{ path: "..." }` object entries
 * (createBrowserRouter form). Skips `*`. Dynamic segments → navigable false.
 */
export function parseReactRouterRoutes(contents: string[]): DerivedRoute[] {
  const found: DerivedRoute[] = [];

  for (const source of contents) {
    // JSX / createElement-style: path="..." or path='...' or path={`...`}
    const jsxRe =
      /\bpath\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})/g;
    let m: RegExpExecArray | null;
    while ((m = jsxRe.exec(source)) !== null) {
      const raw = m[1] ?? m[2];
      if (raw === undefined) continue;
      const route = toDerived(raw);
      if (route) found.push(route);
    }

    // Object form: path: "..." or path: '...'
    const objRe = /\bpath\s*:\s*["']([^"']+)["']/g;
    while ((m = objRe.exec(source)) !== null) {
      const raw = m[1];
      if (raw === undefined) continue;
      const route = toDerived(raw);
      if (route) found.push(route);
    }
  }

  return collectRoutes(found);
}

function toDerived(rawPath: string): DerivedRoute | null {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) return null;
  // Skip splat / catch-all only routes.
  if (trimmed === '*' || trimmed === '/*') return null;

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  // Drop trailing slash except root.
  const path =
    withSlash.length > 1 && withSlash.endsWith('/')
      ? withSlash.slice(0, -1)
      : withSlash;

  const hasDynamic =
    path.includes(':') || path.includes('*') || path.includes('(');
  return { path, navigable: !hasDynamic };
}
