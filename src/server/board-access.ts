/**
 * Board-password access-grant cookie codec — pure (no framework imports, no
 * node imports), platform-neutral: cookie STRINGS, not framework response
 * objects. The grant is the HMAC token `board.password.verify()` returns; it
 * lives in ONE httpOnly cookie owned by the host app (the SDK never sees
 * server storage — ) and is threaded to gated reads as the
 * `X-Board-Access` header. The `/password` redirect guards live in
 * `./redirect-guard` (pure URL logic, no cookies).
 */
import {
  buildClearCookie,
  buildCookie,
  cookieScope,
  readCookie,
} from './cookie';

export const BOARD_ACCESS_COOKIE_NAME = '__Host-cavuno_board_access';

/**
 * The grant cookie name, optionally board-scoped — hosted scopes its grant
 * cookie per account (`board_access_<accountId>`) because one app instance
 * can gate multiple boards. Multi-board hosts MUST pass their board
 * identifier; single-board apps omit it.
 */
export function grantCookieName(board?: string): string {
  return board
    ? `${BOARD_ACCESS_COOKIE_NAME}_${cookieScope(board)}`
    : BOARD_ACCESS_COOKIE_NAME;
}

/** Matches the hosted board's access cookie lifetime (24h). */
const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export function serializeGrantCookie(
  token: string,
  options?: { board?: string },
): string {
  return buildCookie(
    grantCookieName(options?.board),
    encodeURIComponent(token),
    COOKIE_MAX_AGE_SECONDS,
  );
}

export function clearGrantCookie(options?: { board?: string }): string {
  return buildClearCookie(grantCookieName(options?.board));
}

export function parseGrantCookie(
  cookieHeader: string | null,
  options?: { board?: string },
): string | null {
  return readCookie(cookieHeader, grantCookieName(options?.board));
}
