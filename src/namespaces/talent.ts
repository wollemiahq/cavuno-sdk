import type { BoardClient, FetchOptions } from '../client';
import type {
  TalentDirectoryListEnvelope,
  TalentDirectoryQuery,
  TalentPlacesListEnvelope,
  TalentPlacesQuery,
  TalentProfile,
} from '../types/talent';

export function talentNamespace(client: BoardClient) {
  return {
    /**
     * List the board's talent directory — candidate cards ranked by
     * job-search status then most-recently-updated, the same ordering the
     * hosted `/talent` page renders. Anonymous callers see `public` profiles;
     * a signed-in board user also sees `logged_in_only` ones.
     *
     * Throws `talent_directory_restricted` (403) when the board restricts the
     * directory to employers (render an employer upsell), or
     * `talent_directory_not_found` (404) when it is disabled.
     *
     * @example
     * const { data } = await board.talent.list({ skill: 'react', limit: 20 });
     */
    list(query?: TalentDirectoryQuery, options?: FetchOptions) {
      const serializedQuery = query
        ? {
            ...query,
            customFields: query.customFields
              ? JSON.stringify(query.customFields)
              : undefined,
            objectReferences: query.objectReferences
              ? JSON.stringify(query.objectReferences)
              : undefined,
          }
        : undefined;
      return client.fetch<TalentDirectoryListEnvelope>('/talent', {
        ...options,
        query: serializedQuery,
      });
    },

    /**
     * Retrieve a candidate's public profile by handle (or board-user id). Only
     * `public` profiles resolve; a non-public or unknown handle throws
     * `talent_not_found` (404). `resumeUrl` is an expiring signed download
     * for a signed-in approved employer when the candidate opted in to share
     * their stored resume; `null` otherwise. Directory cards never include it.
     *
     * @example
     * const profile = await board.talent.retrieve('jane-doe');
     */
    retrieve(handle: string, options?: FetchOptions) {
      return client.fetch<TalentProfile>(
        `/talent/${encodeURIComponent(handle)}`,
        options,
      );
    },

    places: {
      /**
       * List the places the board's directory candidates live in, busiest
       * first, each with how many candidates the caller can see there (a
       * country counts every candidate in its cities). Anonymous callers get
       * counts of `public` profiles; a signed-in board user also counts
       * `logged_in_only` ones. Pass a place's `slug` (or its board-language
       * `canonicalSlug`) as `talent.list`'s `place` filter, and show its
       * board-language `displayName`. With `q`, returns location search
       * matches instead, ranked as `taxonomy.places.list` ranks them.
       *
       * Same access errors as `talent.list`. Returns an empty list until the
       * board's place counts are built.
       *
       * @example
       * const { data: places } = await board.talent.places.list({ limit: 50 });
       * const { data: matches } = await board.talent.places.list({ q: 'lon' });
       */
      list(query?: TalentPlacesQuery, options?: FetchOptions) {
        return client.fetch<TalentPlacesListEnvelope>('/talent/places', {
          ...options,
          query,
        });
      },
    },
  };
}
