import type { BoardClient, FetchOptions } from '../client';
import type {
  PublicCollectionEntriesQuery,
  PublicCollectionEntryList,
} from '../types/collections';

export function collectionsNamespace(client: BoardClient) {
  return {
    /**
     * List the active entries of a collection the operator made public,
     * sorted by name, with only its public fields. A collection that is not
     * public reads as not found (`collections_not_found`). Follow
     * `nextCursor` for more.
     *
     * @example
     * const { data, nextCursor } = await board.collections.entries(
     *   'trade_communities',
     *   { limit: 50 },
     * );
     */
    entries(
      key: string,
      query?: PublicCollectionEntriesQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<PublicCollectionEntryList>(
        `/collections/${encodeURIComponent(key)}/entries`,
        { ...options, query },
      );
    },
  };
}
