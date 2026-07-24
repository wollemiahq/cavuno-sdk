// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response entities alias the generated components;
// the query type stays hand-written (no serializer to drift from).
import type { Schemas } from './_spec';

export type SuggestResult = Schemas['SuggestResult'];
export type SuggestionItem = Schemas['SuggestionItem'];
export type CompanySuggestion = Schemas['CompanySuggestion'];
export type TermSuggestion = Schemas['TermSuggestion'];

/** Query for `board.search.suggest()`. */
export type SearchSuggestQuery = {
  /** Keyword; under 2 chars the server returns an empty `items` array. */
  q?: string;
  /** Max interleaved suggestions (1–25; default 25). */
  limit?: number;
};
