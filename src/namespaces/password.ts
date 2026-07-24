import { BOARD_ACCESS_GRANT_KEY } from '../storage';

import type { BoardClient, FetchOptions } from '../client';
import type { BoardAccessGrant } from '../types/password';

export function passwordNamespace(client: BoardClient) {
  return {
    /**
     * Exchange a board password for an access grant and store it. After this
     * resolves, every subsequent read auto-carries the grant as the
     * `X-Board-Access` header — until the password rotates, after which reads
     * fail with 401 `board_password_required` and you must `verify()` again
     * (the SDK never auto-retries — verify is rate-limited — and never
     * auto-clears; the host re-challenges). On the server (`nostore` storage)
     * the grant is returned but not persisted; pass it per-call instead.
     */
    async verify(
      password: string,
      options?: FetchOptions,
    ): Promise<BoardAccessGrant> {
      const grant = await client.fetch<BoardAccessGrant>('/password/verify', {
        ...options,
        method: 'POST',
        body: { password },
      });
      await client.storage.setItem(BOARD_ACCESS_GRANT_KEY, grant.token);
      return grant;
    },
  };
}
