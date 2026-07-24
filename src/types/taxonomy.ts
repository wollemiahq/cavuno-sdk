// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. The query type stays hand-written (no serializer
// to drift from).
import type { Schemas } from './_spec';

export type TaxonomyGeo = Schemas['TaxonomyGeo'];
export type TaxonomyResolution = Schemas['PublicTaxonomyResolution'];
export type PublicTaxonomyTerm = Schemas['PublicTaxonomyTerm'];
export type PublicPlace = Schemas['PublicPlace'];
/**
 * One canonical remote-permit option (`worldwide`, a world region /
 * continent / region / subregion, a `custom` bloc like EU, an ISO 3166-1
 * `country`, or an ISO 3166-2 `subdivision`) — the `{type, value}` pairs
 * the `remotePermits` and job-posting `remoteWorkingPermits` fields accept.
 */
export type RemotePermitTaxonomyEntry = Schemas['RemotePermitTaxonomyEntry'];

export type TaxonomyListQuery = {
  q?: string;
  cursor?: string;
  limit?: number;
};

export type SuggestionsListQuery = Omit<TaxonomyListQuery, 'cursor'>;

/**
 * Query for `taxonomy.places.list()`. Omit it (or `q`) for the full
 * locations directory; pass `q` (≥2 chars) for location autocomplete — the
 * top name matches ranked, what a location search field renders.
 */
export type PlacesListQuery = {
  /** Location autocomplete query; ≥2 chars → top name matches, under 2 → empty. */
  q?: string;
  /** Max autocomplete results when `q` is given (1–50; default 10). */
  limit?: number;
};
