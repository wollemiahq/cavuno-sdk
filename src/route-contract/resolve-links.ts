/**
 * Platform resolution overlay.
 *
 * Pure + isomorphic: role + params + precedence layers → board path.
 * Imports only sibling route-contract / paths modules.
 */

import { extractParamNames } from './params';
import {
  CANONICAL_MANIFEST,
  REQUIRED_ROLES,
  ROLE_PARAM_REGISTRY,
  type RouteRole,
} from './roles';

import type { ManifestV1 } from './types';

/** One precedence layer supplied by the caller (declared / wellKnown / inferred). */
export type ManifestLayer = {
  source: 'declared' | 'wellKnown' | 'inferred';
  manifest: ManifestV1;
};

export type ResolvedBoardPath = {
  path: string;
  source: 'declared' | 'wellKnown' | 'inferred' | 'canonical';
  /** Set when the winning path came from falling through a broken template. */
  fallback?: 'missing-param';
};

const LAYER_ORDER: readonly ManifestLayer['source'][] = [
  'declared',
  'wellKnown',
  'inferred',
] as const;

const REQUIRED_SET: ReadonlySet<RouteRole> = new Set(REQUIRED_ROLES);

/**
 * Try to substitute registry (and only registry) tokens in `template`.
 * Returns null when any `:token` is missing/unregistered — callers must
 * not emit the literal colon form.
 */
function trySubstitute(
  template: string,
  role: RouteRole,
  params: Record<string, string> | undefined,
): string | null {
  const registry = ROLE_PARAM_REGISTRY[role];
  const registrySet = new Set(registry);
  const tokens = extractParamNames(template);

  for (const name of tokens) {
    if (!registrySet.has(name)) {
      return null;
    }
    if (params?.[name] === undefined) {
      return null;
    }
  }

  // All tokens are registry members with supplied values.
  let path = template;
  for (const name of tokens) {
    path = path.split(`:${name}`).join(params![name]!);
  }
  return path;
}

/**
 * Last-resort substitution for an incomplete canonical template: replace
 * every known token with the supplied value or '' so the path never retains
 * a raw `:param`. Always incomplete by construction when used.
 */
function forceSubstitute(
  template: string,
  params: Record<string, string> | undefined,
): string {
  return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
    return params?.[name] ?? '';
  });
}

function templateFor(
  manifest: ManifestV1,
  role: RouteRole,
): string | undefined {
  const t = manifest.roles[role];
  if (typeof t !== 'string' || t.length === 0) return undefined;
  return t;
}

export function createBoardLinkResolver(layers: readonly ManifestLayer[]) {
  // Index the first layer per source (callers rarely pass duplicates).
  const bySource = new Map<ManifestLayer['source'], ManifestLayer>();
  for (const layer of layers) {
    if (!bySource.has(layer.source)) {
      bySource.set(layer.source, layer);
    }
  }

  return {
    pathFor(
      role: RouteRole,
      params?: Record<string, string>,
    ): ResolvedBoardPath {
      let sawMissingParam = false;

      for (const source of LAYER_ORDER) {
        if (source === 'inferred' && REQUIRED_SET.has(role)) {
          // Email-adjacent defense: never serve REQUIRED_ROLES from inferred.
          continue;
        }
        const layer = bySource.get(source);
        if (!layer) continue;

        const template = templateFor(layer.manifest, role);
        if (template === undefined) continue;

        const path = trySubstitute(template, role, params);
        if (path !== null) {
          // A complete later layer wins cleanly (no fallback flag) — the
          // missing-param flag is only attached when we land on canonical.
          return { path, source };
        }
        sawMissingParam = true;
      }

      // Canonical default (always present for every registry role).
      const canonicalTemplate =
        templateFor(CANONICAL_MANIFEST, role) ??
        CANONICAL_MANIFEST.roles[role] ??
        '/';
      const path = trySubstitute(canonicalTemplate, role, params);
      if (path !== null) {
        return sawMissingParam
          ? { path, source: 'canonical', fallback: 'missing-param' }
          : { path, source: 'canonical' };
      }

      // Incomplete even on canonical — never emit ':' tokens.
      return {
        path: forceSubstitute(canonicalTemplate, params),
        source: 'canonical',
        fallback: 'missing-param',
      };
    },
  };
}
