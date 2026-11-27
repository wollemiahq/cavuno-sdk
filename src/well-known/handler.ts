/**
 * Runtime well-known endpoint — Request → Response serving ManifestV1
 * compiled from the app's enumerated routes.
 *
 * Pure + isomorphic: no node builtins, no framework imports. The app hands
 * over RouteEntry[] (or a thunk) computed from its router; this module only
 * compiles and serializes.
 */

import {
  compileManifest,
  type ManifestV1,
  type RouteEntry,
  type RouteFeature,
  type RouteRole,
  validateManifest,
} from '../route-contract';

/** Modest CDN/browser cache — structure changes only on redeploy/HMR. */
export const WELL_KNOWN_CACHE_CONTROL = 'public, max-age=300';

export const WELL_KNOWN_CONTENT_TYPE = 'application/json';

export type WellKnownHandlerConfig = {
  /**
   * Enumerated routes from the app's router. May be a static array or a
   * thunk (sync or async) so the tree can be re-read per request.
   */
  routes: RouteEntry[] | (() => RouteEntry[] | Promise<RouteEntry[]>);
  /** Optional cavunoPage marker map keyed by sourcePath. */
  markers?: ReadonlyMap<string, RouteRole>;
  /** Behaviours the site supports across its pages. */
  features?: ReadonlySet<RouteFeature>;
  /**
   * The folder the board is served from, such as `/careers` when the app
   * runs at `example.com/careers`. Give `routes` as the router sees them,
   * without the folder: the manifest names every role under it and carries
   * it as `basePath`. Omit it, or pass `/`, for the domain root.
   */
  basePath?: string;
};

export type WellKnownHandler = (request: Request) => Promise<Response>;

/**
 * Create a framework-portable Request → Response handler that serves the
 * compiled ManifestV1 as JSON. Wire format is the versioned manifest only
 * (warnings/ambiguities stay build/doctor concerns).
 */
export function createWellKnownHandler(
  config: WellKnownHandlerConfig,
): WellKnownHandler {
  // Checked here, not per request: a bad folder fails at startup instead of
  // as a bare 500 the board's manifest pull can't explain.
  const basePath = checkedBasePath(config.basePath);
  return async (_request: Request): Promise<Response> => {
    try {
      const routes = await resolveRoutes(config.routes);
      const { manifest } = compileManifest(
        routes,
        config.markers,
        config.features,
      );
      const body = serializeManifest(underBasePath(manifest, basePath));
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': WELL_KNOWN_CONTENT_TYPE,
          'cache-control': WELL_KNOWN_CACHE_CONTROL,
        },
      });
    } catch {
      // Never leak stacks or error messages into the response body.
      return new Response('', { status: 500 });
    }
  };
}

async function resolveRoutes(
  routes: WellKnownHandlerConfig['routes'],
): Promise<RouteEntry[]> {
  if (typeof routes === 'function') {
    return await routes();
  }
  return routes;
}

/**
 * The configured folder as the manifest carries it: `undefined` for the
 * domain root. Throws on a folder `validateManifest` would refuse.
 */
export function checkedBasePath(
  basePath: string | undefined,
): string | undefined {
  if (basePath === undefined) return undefined;
  const result = validateManifest({ version: 1, roles: {}, basePath });
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join('; '));
  }
  return result.manifest.basePath;
}

/** `manifest` with every role template under `basePath`, and `basePath` set. */
export function underBasePath(
  manifest: ManifestV1,
  basePath: string | undefined,
): ManifestV1 {
  if (basePath === undefined) return manifest;
  const roles: ManifestV1['roles'] = {};
  for (const [role, template] of Object.entries(manifest.roles) as [
    RouteRole,
    string,
  ][]) {
    roles[role] = template === '/' ? basePath : `${basePath}${template}`;
  }
  return { ...manifest, roles, basePath };
}

/**
 * Deterministic JSON for ManifestV1. Roles are already inserted in
 * ALL_ROLES order by compileManifest — preserve that insertion order.
 */
export function serializeManifest(manifest: ManifestV1): string {
  return JSON.stringify(manifest);
}
