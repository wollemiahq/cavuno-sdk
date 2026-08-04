import type { BoardClient, FetchOptions } from '../client';
import type { SearchSuggestQuery, SuggestResult } from '../types/search';

/**
 * `board.search.*` — federated keyword suggestions for the search dropdown.
 */
export function searchNamespace(client: BoardClient) {
  return {
    /**
     * GET /search/suggest — federated keyword suggestions (companies,
     * markets, taxonomy terms), one interleaved server-ranked list. Pass
     * `types` to restrict kinds; `limit` applies after that filter. Order
     * is the contract: do not re-sort. Routing is application-side via
     * `suggestionPath` from `@cavuno/board/paths`.
     *
     * @example
     * const { items } = await board.search.suggest({
     *   q: 'acme',
     *   limit: 10,
     *   types: ['company', 'skill'],
     * });
     */
    suggest(query?: SearchSuggestQuery, options?: FetchOptions) {
      return client.fetch<SuggestResult>('/search/suggest', {
        ...options,
        query,
      });
    },
  };
}
