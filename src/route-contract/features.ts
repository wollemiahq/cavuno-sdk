/**
 * Feature vocabulary for the per-board route manifest. A role says which
 * page a path is; a feature says the site supports a behaviour across its
 * existing pages, so the dashboard can offer the matching setting only to
 * boards whose live site handles it.
 *
 * - `talentFreeTrial`: the talent directory, profile and messaging pages let
 *   an employer spend free profile unlocks and free conversations before
 *   they hold a plan, and say when an action is free.
 *
 * Pure + isomorphic: no imports.
 */

export const ALL_FEATURES = ['talentFreeTrial'] as const;

export type RouteFeature = (typeof ALL_FEATURES)[number];

const FEATURE_SET: ReadonlySet<string> = new Set(ALL_FEATURES);

export function isRouteFeature(value: string): value is RouteFeature {
  return FEATURE_SET.has(value);
}
