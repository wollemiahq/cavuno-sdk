import {
  buildClearCookie,
  buildCookie,
  cookieScope,
  readCookie,
} from './cookie';

/**
 * Session cookie codec — pure (no framework imports, no node imports) so it
 * stays hermetically testable and platform-neutral: helpers speak cookie
 * STRINGS (`Set-Cookie` values / `Cookie` headers), never framework response
 * objects. The session is the SDK bearer pair plus the access-token expiry;
 * it lives in ONE httpOnly cookie owned by the host app (the SDK never sees
 * storage on the server — ).
 */
export interface BoardSession {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry, epoch ms (from board_auth_session). */
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = '__Host-cavuno_board_session';

/**
 * The session cookie name, optionally board-scoped. One origin can serve
 * multiple boards (the hosted platform scopes its grant cookie per account
 * for this reason) — a multi-board host MUST pass its board identifier so
 * sessions cannot clobber each other; single-board apps omit it.
 */
export function sessionCookieName(board?: string): string {
  return board
    ? `${SESSION_COOKIE_NAME}_${cookieScope(board)}`
    : SESSION_COOKIE_NAME;
}

/** Refresh tokens live 30 days server-side; the cookie matches. */
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Proactive-refresh window: refresh while the old access token still works. */
const EXPIRY_WINDOW_MS = 5 * 60 * 1000;

export function serializeSessionCookie(
  session: BoardSession,
  options?: { board?: string },
): string {
  return buildCookie(
    sessionCookieName(options?.board),
    encodeURIComponent(JSON.stringify(session)),
    COOKIE_MAX_AGE_SECONDS,
  );
}

export function clearSessionCookie(options?: { board?: string }): string {
  return buildClearCookie(sessionCookieName(options?.board));
}

export function parseSessionCookie(
  cookieHeader: string | null,
  options?: { board?: string },
): BoardSession | null {
  const raw = readCookie(cookieHeader, sessionCookieName(options?.board));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const session = parsed as Partial<BoardSession> | null;
  if (
    !session ||
    typeof session.accessToken !== 'string' ||
    typeof session.refreshToken !== 'string' ||
    typeof session.expiresAt !== 'number'
  ) {
    return null;
  }
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  };
}

export function isExpiringSoon(
  session: BoardSession,
  now: number,
  windowMs: number = EXPIRY_WINDOW_MS,
): boolean {
  return session.expiresAt - now < windowMs;
}
