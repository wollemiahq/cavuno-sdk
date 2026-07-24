import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type { EmbedJobsQuery } from '../types/embed';
import type { PublicJobCard } from '../types/jobs';

export function embedNamespace(client: BoardClient) {
  return {
    /**
     * List published jobs for an embeddable widget — the same featured-ranked
     * cards as `board.jobs.list`, but UNGATED: the candidate paywall never
     * applies, so the full page is always returned and there is no
     * `gatedCount`. Powers the public "Powered by Cavuno" embed. `limit`
     * defaults to 8 and is clamped to a maximum of 50.
     *
     * @example
     * const { data, nextCursor } = await board.embed.jobs({ q: 'chef', limit: 8 });
     */
    jobs(query?: EmbedJobsQuery, options?: FetchOptions) {
      return client.fetch<ListEnvelope<PublicJobCard>>('/embed/jobs', {
        ...options,
        query,
      });
    },
  };
}
