import { isUnauthorized } from '../errors';
import { isNoStore } from '../storage';

import type { BoardSdk } from '../index';
import type { BoardSession } from './session';

/**
 * Single-flight session refresh — dedupes concurrent refreshes for the same
 * session WITHIN one process/isolate (the rotation race,  ,
 * mitigated at the one layer a client library can reach).
 *
 * Refresh tokens are single-use: two concurrent refreshes for the same
 * session burn the pair — the loser 401s and the user is signed out
 * mid-session. This helper keys an in-flight slot per refreshToken so every
 * concurrent caller awaits the SAME rotation; sequential calls after settle
 * start a fresh one.
 *
 * Scope honestly stated: the dedupe is PER PROCESS/ISOLATE (an in-memory
 * map). Two simultaneous requests served by different instances can still
 * race the token; the proactive `isExpiringSoon` window keeps that rare, it
 * does not eliminate it. Pair with `storage: 'nostore'` on the shared
 * server client — `auth.refresh` persists the rotated pair into
 * `client.storage`, and any persistent shared storage would bleed one
 * user's tokens into another's requests.
 *
 * Returns the rotated `BoardSession` (persist it back to the cookie), or
 * `null` on a 401 — the token is burned or revoked: clear the cookie and
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
  // into `client.storage` — on a server, anything but the no-op store means
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

  const inflight = new Map<string, Promise<BoardSession | null>>();

  return async function refresh(
    session: BoardSession,
  ): Promise<BoardSession | null> {
    const key = session.refreshToken;
    const existing = inflight.get(key);
    if (existing) return existing;

    const attempt = board.auth
      .refresh({ refreshToken: key })
      .then(
        (rotated): BoardSession => ({
          accessToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
          expiresAt: rotated.expiresAt,
        }),
      )
      .catch((error: unknown) => {
        // Burned single-use token (a parallel refresh won) or revoked
        // session — signed out either way. `isUnauthorized` is structural
        // (see errors.ts), so it classifies core-bundle errors correctly.
        if (isUnauthorized(error)) return null;
        throw error;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, attempt);
    return attempt;
  };
}
