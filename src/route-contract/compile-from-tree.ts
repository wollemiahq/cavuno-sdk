/**
 *  — compile a ManifestV1 from a workspace file tree already in
 * memory (candidate verification). Pure: no IO.
 */

import { compileManifest } from './compile';
import { enumerateRouteEntries } from './enumerate';
import { extractCavunoPageMarker } from './markers';

import type { RouteRole } from './roles';
import type { CompileResult } from './types';

export type TreeFile = {
  path: string;
  contents: string;
};

/**
 * Enumerate routes from file paths, harvest cavunoPage markers from every
 * file body, run compileManifest. Marker harvest is intentionally broad
 * (all files, not just ambiguous) — cheap string scan, correct for renames.
 */
export function compileManifestFromTree(
  files: ReadonlyArray<TreeFile>,
): CompileResult {
  const paths = files.map((f) => f.path);
  const routes = enumerateRouteEntries(paths);
  const markers = new Map<string, RouteRole>();
  for (const file of files) {
    const role = extractCavunoPageMarker(file.contents);
    if (role !== null) {
      markers.set(file.path.replace(/^\.\//, ''), role);
    }
  }
  return compileManifest(routes, markers.size > 0 ? markers : undefined);
}
