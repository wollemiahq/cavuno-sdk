/**
 * `@cavuno/board/well-known` — runtime + build-plugin surface for
 * `/.well-known/cavuno.json`.
 *
 * Pure, dependency-free: imports only the sibling route-contract module.
 * No node builtins, no framework packages. The app enumerates its router
 * (TanStack helper included); this module compiles and serves/emits the
 * versioned ManifestV1.
 */

export {
  createWellKnownHandler,
  serializeManifest,
  WELL_KNOWN_CACHE_CONTROL,
  WELL_KNOWN_CONTENT_TYPE,
  type WellKnownHandler,
  type WellKnownHandlerConfig,
} from './handler';

export {
  emitWellKnownManifest,
  WELL_KNOWN_MANIFEST_PATH,
  type EmitWellKnownManifestConfig,
  type EmitWellKnownManifestResult,
} from './emit';

export {
  routeEntriesFromTanStackRouteTree,
  tanStackPathToUrlPattern,
  type TanStackRouteNode,
} from './tanstack';
