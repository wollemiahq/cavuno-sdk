import type { BoardClient, FetchOptions } from '../client';
import type {
  TalentDirectoryListEnvelope,
  TalentDirectoryQuery,
  TalentProfile,
} from '../types/talent';

export function talentNamespace(client: BoardClient) {
  return {
    /**
     * List the board's public talent directory — candidate cards ranked by
     * job-search status then most-recently-updated, the same ordering the
     * hosted `/talent` page renders. Only `public` profiles appear.
     *
     * Throws `talent_directory_restricted` (403) when the board restricts the
     * directory to employers (render an employer upsell), or
     * `talent_directory_not_found` (404) when it is disabled.
     *
     * @example
     * const { data } = await board.talent.list({ skill: 'react', limit: 20 });
     */
    list(query?: TalentDirectoryQuery, options?: FetchOptions) {
      return client.fetch<TalentDirectoryListEnvelope>('/talent', {
        ...options,
        query,
      });
    },

    /**
     * Retrieve a candidate's public profile by handle (or board-user id). Only
     * `public` profiles resolve; a non-public or unknown handle throws
     * `talent_not_found` (404).
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
  };
}
