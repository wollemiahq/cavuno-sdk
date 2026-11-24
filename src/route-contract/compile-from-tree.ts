/**
 *  — compile a ManifestV1 from a workspace file tree already in
 * memory (candidate verification). Pure: no IO.
 */

import { compileManifest } from './compile';
import { enumerateRouteEntries } from './enumerate';
import {
  extractCavunoFeaturesMarker,
  extractCavunoPageMarker,
} from './markers';

import type { RouteFeature } from './features';
import type { RouteRole } from './roles';
import type { CompileResult } from './types';

export type TreeFile = {
  path: string;
  contents: string;
};

/** Source files that can declare `cavunoFeatures`. */
const CODE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * Features about one page, counted only from the file that marks that page
 * with `cavunoPage`: a page elsewhere can't say what this one does.
 */
const PAGE_FEATURES: Partial<Record<RouteFeature, RouteRole>> = {
  assistantConsentScopes: 'assistantConsent',
};

/**
 * Enumerate routes from file paths, harvest cavunoPage and cavunoFeatures
 * markers from every file body, run compileManifest. Marker harvest is
 * intentionally broad (all files, not just ambiguous) — cheap string scan,
 * correct for renames. Features come from code files only: docs and skills
 * committed to a site quote the marker without declaring it. A feature
 * about one page (`assistantConsentScopes`) counts only from the file that
 * marks that page. An unknown feature name, or a page's feature declared
 * elsewhere, is a warning.
 */
export function compileManifestFromTree(
  files: ReadonlyArray<TreeFile>,
): CompileResult {
  const paths = files.map((f) => f.path);
  const routes = enumerateRouteEntries(paths);
  const markers = new Map<string, RouteRole>();
  const features = new Set<RouteFeature>();
  const unknownFeatures = new Set<string>();
  const misplacedFeatures: string[] = [];
  for (const file of files) {
    const role = extractCavunoPageMarker(file.contents);
    if (role !== null) {
      markers.set(file.path.replace(/^\.\//, ''), role);
    }
    if (!CODE_FILE.test(file.path)) continue;
    const declared = extractCavunoFeaturesMarker(file.contents);
    for (const feature of declared.features) {
      const page = PAGE_FEATURES[feature];
      if (page !== undefined && page !== role) {
        misplacedFeatures.push(
          `feature '${feature}' in cavunoFeatures of ${file.path} ignored: declare it on the page with export const cavunoPage = '${page}'`,
        );
        continue;
      }
      features.add(feature);
    }
    for (const name of declared.unknown) unknownFeatures.add(name);
  }
  const result = compileManifest(
    routes,
    markers.size > 0 ? markers : undefined,
    features,
  );
  for (const name of unknownFeatures) {
    result.warnings.push(`unknown feature '${name}' in cavunoFeatures`);
  }
  result.warnings.push(...misplacedFeatures);
  return result;
}
