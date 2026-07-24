import type { BoardClient, FetchOptions } from '../client';
import type { RedirectResolution } from '../types/redirects';

export function redirectsNamespace(client: BoardClient) {
  return {
    /**
     * Resolve a board-relative path against the board's configured redirects —
     * the same resolution the hosted board's catch-all performs. 308 to
     * `target`, or 404 when `target` is `null`.
     *
     * @example
     * const { target } = await board.redirects.resolve('/old-jobs')
     */
    resolve(path: string, options?: FetchOptions) {
      return client.fetch<RedirectResolution>('/redirects/resolve', {
        ...options,
        query: { path },
      });
    },
  };
}
