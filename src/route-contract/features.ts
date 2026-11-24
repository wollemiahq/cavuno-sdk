/**
 * Feature vocabulary for the per-board route manifest. A role says which
 * page a path is; a feature says the site supports a behaviour across its
 * existing pages, so the dashboard can offer the matching setting only to
 * boards whose live site handles it.
 *
 * - `talentFreeTrial`: the talent directory, profile and messaging pages let
 *   an employer spend free profile unlocks and free conversations before
 *   they hold a plan, and say when an action is free.
 * - `assistantConsentScopes`: the assistant consent page (`assistantConsent`)
 *   lists the step's `requestedScopes` as checkboxes and sends the ticked
 *   ones back as `approvedScopes`, so it can take sign-ins that ask for
 *   fine scopes (`profile.read`, `jobs.publish`) as well as `candidate` and
 *   `employer`.
 *
 * Pure + isomorphic: no imports.
 */

export const ALL_FEATURES = [
  'talentFreeTrial',
  'assistantConsentScopes',
] as const;

export type RouteFeature = (typeof ALL_FEATURES)[number];

const FEATURE_SET: ReadonlySet<string> = new Set(ALL_FEATURES);

export function isRouteFeature(value: string): value is RouteFeature {
  return FEATURE_SET.has(value);
}
