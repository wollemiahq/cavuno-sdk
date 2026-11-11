// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts.
import type { Schemas } from './_spec';

/**
 * One active entry of a collection the operator made public
 * (`board.collections.entries()`), with only its public fields.
 */
export type PublicCollectionEntry = Schemas['PublicCollectionEntry'];

/** A page of public collection entries. Follow `nextCursor` for more. */
export type PublicCollectionEntryList = Schemas['PublicCollectionEntryList'];

export type PublicCollectionEntriesQuery = {
  cursor?: string;
  /** Entries per page, 1 to 100. Defaults to 25. */
  limit?: number;
};
