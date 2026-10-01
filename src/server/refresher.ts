import { isUnauthorized } from '../errors';
import { isNoStore } from '../storage';

import type { BoardSdk } from '../index';
import type { BoardSession } from './session';

/**
 * Session refresh for server-rendered apps. Each call rotates the given
 * session's refresh token with `board.auth.refresh` and maps the result to a
 * `BoardSession`.
 *
 * No state is held across calls. The refresher is usually module-scoped and
 * shared by every request, so a promise kept between calls would be shared
 * across requests too. On edge runtimes such as Cloudflare Workers, I/O
 * belongs to the request that started it: when that request is cancelled
 * (for example the client disconnects), its fetch is cancelled and a promise
 * waiting on it never settles. Any later request awaiting that shared promise
 * would hang. Each call therefore performs its own refresh.
 *
 * Concurrent refreshes of the same session are safe without client-side
 * coordination: the refresh endpoint returns the same successor refresh token
 * for a token re-presented within a short grace window, so parallel calls
 * (in one process or across instances) converge on one refresh token. Their
 * access tokens may differ; each is valid.
 *
 * Pair with `storage: 'nostore'` on the shared server client.
 * `auth.refresh` persists the rotated pair into `client.storage`, and any
 * persistent shared storage would bleed one user's tokens into another's
 * requests.
 *
 * Returns the rotated `BoardSession` (persist it back to the cookie), or
 * `null` on a 401: the token is expired or revoked, so clear the cookie and
 * continue signed out, never retry. Other errors (network, 5xx, 429)
 * rethrow untouched.
 *
 * @example
 * const refreshSession = createSessionRefresher(board);
 * // in the session middleware:
 * if (isExpiringSoon(session, Date.now())) {
 *   const next = await refreshSession(session);
 *   setCookie(next ? serializeSessionCookie(next) : clearSessionCookie());
 * }
 */
export function createSessionRefresher(
  board: Pick<BoardSdk, 'auth' | 'client'>,
) {
  // Fail loud at construction: the refresher is designed to be module-scoped
  // and shared across requests, and `auth.refresh` persists the rotated pair
  // into `client.storage`. On a server, anything but the no-op store means
  // one user's tokens bleed into other requests' reads (cross-user session
  // leak). Cookie-owned sessions pass tokens per call; storage stays nostore.
  if (
    typeof (globalThis as { document?: unknown }).document === 'undefined' &&
    !isNoStore(board.client.storage)
  ) {
    throw new Error(
      "createSessionRefresher requires the server client to use storage: 'nostore' — " +
        'a shared persistent store would leak rotated tokens across requests. ' +
        'Keep the session in the httpOnly cookie and pass tokens per call.',
    );
  }

  return async function refresh(
    session: BoardSession,
  ): Promise<BoardSession | null> {
    try {
      const rotated = await board.auth.refresh({
        refreshToken: session.refreshToken,
      });
      return {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        expiresAt: rotated.expiresAt,
      };
    } catch (error: unknown) {
      // Expired or revoked session: signed out. `isUnauthorized` is
      // structural (see errors.ts), so it classifies core-bundle errors
      // correctly.
      if (isUnauthorized(error)) return null;
      throw error;
    }
  };
}
