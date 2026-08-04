// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response entities alias the generated components;
// the query type stays hand-written (no serializer to drift from).
import type { Schemas } from './_spec';

export type SuggestResult = Schemas['SuggestResult'];
export type SuggestionItem = Schemas['SuggestionItem'];
export type CompanySuggestion = Schemas['CompanySuggestion'];
export type MarketSuggestion = Schemas['MarketSuggestion'];
export type TermSuggestion = Schemas['TermSuggestion'];
export type PostSuggestion = Schemas['PostSuggestion'];
export type TagSuggestion = Schemas['TagSuggestion'];

/** Kinds accepted by `SearchSuggestQuery.types`. */
export type SearchSuggestType =
  | 'company'
  | 'category'
  | 'skill'
  | 'market'
  | 'post'
  | 'tag';

/** Query for `board.search.suggest()`. */
export type SearchSuggestQuery = {
  /** Keyword; under 2 chars the server returns an empty `items` array. */
  q?: string;
  /**
   * Max interleaved suggestions after type filtering (1–25; default 25).
   * With `types: ['skill']`, this is "up to N skills", not N of a mixed pool.
   */
  limit?: number;
  /**
   * Include only these suggestion kinds. Omit for every kind (company,
   * category, skill, market, post, tag). Repeated query keys on the wire.
   */
  types?: SearchSuggestType[];
};
