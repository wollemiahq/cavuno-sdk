/**
 * `@cavuno/board/server` — SSR session plumbing.
 *
 * Pure, zero-dep, platform-neutral: every helper speaks cookie STRINGS
 * (`Set-Cookie` values in, `Cookie` headers out) — never framework request/
 * response objects — so the same code wires into TanStack Start, Next.js,
 * Remix, or a bare Worker. The middleware objects themselves stay
 * framework-owned (see the `cavuno-board-tanstack-start` flavor skill for
 * the reference wiring).
 *
 * Three pieces:
 * - the session cookie codec (`__Host-cavuno_board_session` — the SDK bearer
 *   pair in ONE httpOnly cookie owned by the host app);
 * - the board-password grant codec (`__Host-cavuno_board_access`) + the
 *   open-redirect guards, tested against the hosted board's
 *   `validate-redirect-path`;
 * - `createSessionRefresher` — the single-flight rotation helper for the
 *   single-use refresh token.
 */
export {
  SESSION_COOKIE_NAME,
  sessionCookieName,
  clearSessionCookie,
  isExpiringSoon,
  parseSessionCookie,
  serializeSessionCookie,
} from './session';
export type { BoardSession } from './session';
export {
  BOARD_ACCESS_COOKIE_NAME,
  grantCookieName,
  clearGrantCookie,
  parseGrantCookie,
  serializeGrantCookie,
} from './board-access';
export { currentPathFromReferer, safeRedirectPath } from './redirect-guard';
export {
  getCavunoAppCanonicalRedirectUrl,
  isCavunoAppServingHost,
} from './canonical-host-redirect';
export { createSessionRefresher } from './refresher';
