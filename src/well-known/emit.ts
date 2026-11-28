/**
 * Build-plugin variant of the well-known manifest
 *.
 *
 * Pure function — no fs imports and no write callback: callers (vite
 * plugin, starter build hook) own the write of `contents` to `path` under
 * `public/`, including error handling — a swallowed async write in a build
 * step would be a silent broken artifact.
 */

import {
  compileManifest,
  type RouteEntry,
  type RouteFeature,
  type RouteRole,
} from '../route-contract';
import { checkedBasePath, serializeManifest, underBasePath } from './handler';

export const WELL_KNOWN_MANIFEST_PATH = '.well-known/cavuno.json';

export type EmitWellKnownManifestConfig = {
  routes: RouteEntry[];
  markers?: ReadonlyMap<string, RouteRole>;
  /** Behaviours the site supports across its pages. */
  features?: ReadonlySet<RouteFeature>;
  /**
   * The folder the board is served from, such as `/careers`; see
   * `WellKnownHandlerConfig.basePath`. Throws on an invalid folder.
   */
  basePath?: string;
};

export type EmitWellKnownManifestResult = {
  path: string;
  contents: string;
};

/**
 * Compile routes into a ManifestV1 document ready to land at
 * `public/.well-known/cavuno.json`. Returns path + contents.
 */
export function emitWellKnownManifest(
  config: EmitWellKnownManifestConfig,
): EmitWellKnownManifestResult {
  const { manifest } = compileManifest(
    config.routes,
    config.markers,
    config.features,
  );
  const contents = serializeManifest(
    underBasePath(manifest, checkedBasePath(config.basePath)),
  );
  return { path: WELL_KNOWN_MANIFEST_PATH, contents };
}
