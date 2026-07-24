/**
 * Route-contract compiler — pure, dependency-free seam that turns a route
 * enumeration into a validated role→template manifest.
 *
 * Zero runtime dependencies. Imports only TypeScript stdlib and the sibling
 * paths module. No IO, no node builtins, no URLPattern instantiation —
 * templates are emitted as `:param` strings for consumers to match.
 *
 *  also re-exports the framework adapter registry (enumerate/) so the
 * worker can compile without a UI-layer import.
 */

export {
  ALL_ROLES,
  CANONICAL_MANIFEST,
  isRouteRole,
  REQUIRED_ROLES,
  ROLE_PARAM_REGISTRY,
  type RouteRole,
} from './roles';

export type {
  Ambiguity,
  ClassifyResult,
  CompileResult,
  ManifestV1,
  RouteEntry,
  ValidateManifestError,
  ValidateManifestResult,
} from './types';

export { classifyRoutes } from './classify';
export { compileManifest } from './compile';
export { compileManifestFromTree, type TreeFile } from './compile-from-tree';
export { extractCavunoPageMarker } from './markers';
export { extractParamNames, sameParamSet } from './params';
export { checkRoleTemplate, validateManifest } from './validate';
export {
  createBoardLinkResolver,
  type ManifestLayer,
  type ResolvedBoardPath,
} from './resolve-links';
export {
  matchPathAgainstHistory,
  matchPathToTemplate,
  ROLE_INDEX_PATHS,
  type HistoryMatchEntry,
  type HistoryMatchResult,
} from './match-history';

// ─── Framework adapter registry ───
export {
  deriveRoutes,
  detectFramework,
  enumerateRouteEntries,
  getReactRouterCandidatePaths,
  parseReactRouterRoutes,
  parseTanStackRoutes,
  parseNextRoutes,
  parseAstroRoutes,
  parseSvelteKitRoutes,
  parseNuxtRoutes,
  type DerivedRoute,
  type FrameworkId,
} from './enumerate';
