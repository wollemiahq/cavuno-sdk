/**
 * TanStack Start / TanStack Router file-based route conventions under
 * `src/routes/`. Behavior preserved exactly from the  parser.
 *
 *   - `index` → parent path (`src/routes/index.tsx` → `/`)
 *   - dots nest (`jobs.index.tsx` → `/jobs`)
 *   - `$param` → dynamic segment (`jobs.$jobId.tsx` → `/jobs/:jobId`)
 *   - `prefix{$param}` → param with fixed text before it (`@{$handle}.tsx` →
 *     `/@:handle`); optional `{-$param}` groups are not supported (skipped)
 *   - `__root` is layout only (skipped)
 *   - `-` prefix excludes the file/folder
 *   - `_` prefix is a pathless layout segment (stripped from the URL)
 *
 * Dynamic patterns are listed but not navigable in v1.
 */

import { collectRoutes, normalizeListingPath } from './collect';

import type { DerivedRoute } from './types';

const ROUTES_PREFIX = 'src/routes/';
// Pages only: every page in the starter is .tsx/.jsx, while every
// file-style endpoint (robots[.]txt.ts, jobs.rss[.]xml.ts, *.og.ts) is
// plain .ts — excluding .ts keeps the navigator to human pages.
const PAGE_EXT = /\.(tsx|jsx)$/i;

export function parseTanStackRoutes(paths: string[]): DerivedRoute[] {
  return collectRoutes(paths.map(pathToRoute));
}

function pathToRoute(filePath: string): DerivedRoute | null {
  const normalized = normalizeListingPath(filePath);
  if (!normalized.startsWith(ROUTES_PREFIX)) return null;
  // `.d.ts` ends in `.ts` — exclude declaration files explicitly.
  if (normalized.endsWith('.d.ts')) return null;
  if (!PAGE_EXT.test(normalized)) return null;

  const rel = normalized.slice(ROUTES_PREFIX.length).replace(PAGE_EXT, '');
  if (rel.length === 0) return null;
  // `route.tsx` is a layout/config file, not a page — in both the
  // directory form (posts/route.tsx) and the flat co-located form
  // (posts.route.tsx). Deriving "/posts/route" would be a phantom.
  if (rel === 'route' || rel.endsWith('/route') || rel.endsWith('.route')) {
    return null;
  }
  // TanStack escape syntax ([.] literal dots) marks file-style endpoints
  // (`blog.og.{$postSlug}[.]json.ts`); naive dot-splitting would shred them
  // into garbage segments, and none of them belong in a page navigator.
  if (rel.includes('[')) return null;

  // Directory segments (`/`) and flat-nesting segments (`.`) both
  // become URL segments under TanStack file routing.
  const rawSegments = rel
    .split('/')
    .flatMap((part) => part.split('.'))
    .filter((seg) => seg.length > 0);

  const urlSegments: string[] = [];
  let hasDynamic = false;
  let hadIndex = false;
  let hadConcrete = false;

  for (const seg of rawSegments) {
    if (seg.startsWith('-')) return null;
    if (seg === '__root') return null;
    // Pathless layout segment: keep the route id locally, strip from URL.
    if (seg.startsWith('_')) continue;
    if (seg === 'index') {
      hadIndex = true;
      continue;
    }
    if (seg.includes('{') || seg.includes('}')) {
      const pattern = tanStackBraceSegmentToPattern(seg);
      if (pattern === null) return null;
      hasDynamic = true;
      hadConcrete = true;
      urlSegments.push(pattern);
      continue;
    }
    if (seg.startsWith('$')) {
      hasDynamic = true;
      hadConcrete = true;
      const param = seg.slice(1);
      // Bare `$` is the splat/catch-all route.
      urlSegments.push(param.length > 0 ? `:${param}` : '*');
      continue;
    }
    hadConcrete = true;
    urlSegments.push(seg);
  }

  // Pure pathless layout file (`_layout.tsx`) contributes no page.
  if (urlSegments.length === 0 && !hadIndex && !hadConcrete) {
    return null;
  }

  const path = urlSegments.length === 0 ? '/' : `/${urlSegments.join('/')}`;
  return { path, navigable: !hasDynamic, sourcePath: normalized };
}

/**
 * Convert one TanStack brace-param segment (`prefix{$param}`) to URLPattern
 * form (`prefix:param`), e.g. `@{$handle}` → `@:handle`.
 *
 * Returns null for anything else: optional groups (`{-$param}`), more than
 * one group, or any text after the group. Suffixed segments are file-style
 * endpoints (`{$postSlug}.json`); read as `:postSlug.json` they would share
 * a page role's param signature and make that role ambiguous.
 */
export function tanStackBraceSegmentToPattern(segment: string): string | null {
  const match = /^([^{}$:]*)\{\$([A-Za-z_][A-Za-z0-9_]*)\}([^{}$:]*)$/.exec(
    segment,
  );
  if (match === null) return null;
  const [, prefix = '', name = '', suffix = ''] = match;
  if (suffix !== '') return null;
  return `${prefix}:${name}`;
}
