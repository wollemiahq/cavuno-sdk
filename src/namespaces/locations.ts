import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  LocationResolveInput,
  LocationSearchQuery,
  PublicLocation,
} from '../types/locations';

/**
 * `board.locations.*` — global location search for location inputs such as
 * the office locations of a job-posting form.
 */
export function locationsNamespace(client: BoardClient) {
  return {
    /**
     * GET /locations/search — worldwide autocomplete over countries,
     * regions, cities, and localities, not only places the board's jobs already
     * use (that is `taxonomy.places.list({ q })`). Order is the contract: do
     * not re-sort. Complete a pick with `locations.resolve` using the same
     * session before sending its `id` as `locationId` later.
     *
     * @example
     * const session = crypto.randomUUID();
     * const { data } = await board.locations.search({ q: 'berl', session });
     */
    search(query: LocationSearchQuery, options?: FetchOptions) {
      return client.fetch<ListEnvelope<PublicLocation>>('/locations/search', {
        ...options,
        query,
      });
    },

    /** Complete a picked suggestion with the same search session. */
    resolve(input: LocationResolveInput, options?: FetchOptions) {
      return client.fetch<PublicLocation>('/locations/resolve', {
        ...options,
        method: 'POST',
        body: input,
      });
    },
  };
}
