import type { BoardClient, FetchOptions } from '../client';
import type { SearchSuggestQuery, SuggestResult } from '../types/search';

/**
 * `board.search.*` — federated keyword suggestions for the search dropdown.
 */
export function searchNamespace(client: BoardClient) {
  return {
    /**
     * GET /search/suggest — federated keyword suggestions (companies +
     * taxonomy terms), one interleaved server-ranked list. Order is the
     * contract: do not re-sort.
     *
     * @example
     * const { items } = await board.search.suggest({ q: 'acme', limit: 10 });
     */
    suggest(query?: SearchSuggestQuery, options?: FetchOptions) {
      return client.fetch<SuggestResult>('/search/suggest', {
        ...options,
        query,
      });
    },
  };
}
