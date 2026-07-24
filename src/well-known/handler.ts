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
  type RouteEntry,
  type RouteRole,
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
  return async (_request: Request): Promise<Response> => {
    try {
      const routes = await resolveRoutes(config.routes);
      const { manifest } = compileManifest(routes, config.markers);
      const body = serializeManifest(manifest);
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
 * Deterministic JSON for ManifestV1. Roles are already inserted in
 * ALL_ROLES order by compileManifest — preserve that insertion order.
 */
export function serializeManifest(manifest: {
  version: 1;
  roles: Partial<Record<RouteRole, string>>;
}): string {
  return JSON.stringify(manifest);
}
