// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. The query type stays hand-written (no serializer
// to drift from).
import type { Schemas } from './_spec';

/**
 * One global location search result. `id` is accepted back as `locationId`
 * on job office locations, and shares its id space with `PublicPlace.id`.
 */
export type PublicLocation = Schemas['PublicLocation'];

/** Input for `board.locations.resolve()`. */
export type LocationResolveInput = {
  /** Opaque id returned by board.locations.search(). */
  locationId: string;
  /** The same session used for the search interaction. */
  session: string;
};

export type LocationSearchQuery = {
  /** What the user has typed; under 2 characters the server returns an empty list. */
  q: string;
  /** Maximum results (1–10; default 5). */
  limit?: number;
  /**
   * Comma-separated ISO 3166-1 alpha-2 codes (e.g. `'DE,AT'`) that restrict
   * results to those countries (up to 250). Pass the board's
   * `jobForm.location.allowedCountries` to narrow suggestions to the
   * countries the board allows.
   */
  country?: string;
  /**
   * Required opaque id (for example `crypto.randomUUID()`). Generate one per
   * location-field interaction and reuse it across keystrokes and the resolve
   * call. Renew it before 50 provider requests or after 180 seconds, and use a
   * fresh session for the next interaction.
   */
  session: string;
};
