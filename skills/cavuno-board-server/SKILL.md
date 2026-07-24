---
name: cavuno-board-server
description: SSR session plumbing with @cavuno/board/server — the __Host- httpOnly session-cookie codec (BoardSession serialize/parse/clear + the 5-minute isExpiringSoon window), the board-password grant-cookie codec with the open-redirect guards (safeRedirectPath, currentPathFromReferer), and createSessionRefresher, the single-flight rotation helper for the single-use refresh token. Use when wiring board-user auth or the board-password gate into any server-rendered frontend (TanStack Start, Next.js, Remix, Workers).
---

# Server session plumbing

`@cavuno/board/server` ships the pieces every SSR board frontend re-invents
around auth: cookie codecs and the refresh-rotation helper. Everything is
pure and platform-neutral — helpers take and return cookie **strings**
(`Set-Cookie` values, `Cookie` headers), never framework request/response
objects. The middleware objects themselves stay framework-owned: you write
~20 lines of glue per framework (the `cavuno-board-tanstack-start` flavor
skill has the reference wiring), and everything inside the glue comes from
here.

## When to use

- Holding a board-user session (bearer pair) in an httpOnly cookie on SSR.
- Refreshing the single-use refresh token safely under concurrency.
- Wiring the board-password gate (`board.password.verify()` grant) with a
  safe `?redirect=` round-trip.

## When not to use

- Browser-only SPAs with no server — use `auth.storage: 'local'` /
  `'session'` / `'memory'` instead (see `cavuno-board-auth`).
- Framework middleware objects, CSRF protection, cookie encryption — all
  app-owned. The session cookie is httpOnly + JSON; if you want an encrypted
  cookie, wrap the codec output yourself.

## The session cookie

The SDK never sees server storage (create the client with no `auth.storage`
→ `nostore`). The bearer pair lives in ONE `__Host-` httpOnly cookie owned
by your app; `BoardSession` is `{ accessToken, refreshToken, expiresAt }`.

```ts snippet
import {
  clearSessionCookie,
  parseSessionCookie,
  serializeSessionCookie,
} from '@cavuno/board/server';

// After login: persist the pair (BoardAuthSession already carries expiresAt).
const session = await board.auth.login({ email, password });
setCookieHeader = serializeSessionCookie({
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
  expiresAt: session.expiresAt,
});

// On every request: parse the Cookie header your framework hands you.
const current = parseSessionCookie(request.headers.get('cookie'));

// On logout (after board.auth.logout({ refreshToken })): expire it.
setCookieHeader = clearSessionCookie();
```

`serializeSessionCookie` locks the attributes (`__Host-` prefix, `Path=/`,
`HttpOnly`, `Secure`, `SameSite=Lax`, 30-day `Max-Age` matching the refresh
token's server-side lifetime). `parseSessionCookie` returns `null` for
absent, malformed, or wrong-shape cookies — treat `null` as signed out.

## Single-flight refresh in a session middleware

Refresh tokens are single-use: two concurrent requests that both refresh
burn the pair — the loser 401s and the user is signed out mid-session.
`createSessionRefresher` dedupes concurrent rotations per refreshToken, and
`isExpiringSoon` gives you the proactive 5-minute window so the old access
token still works while you rotate.

```ts snippet
import {
  clearSessionCookie,
  createSessionRefresher,
  isExpiringSoon,
  parseSessionCookie,
  serializeSessionCookie,
} from '@cavuno/board/server';

// Module scope: ONE refresher per board client, shared by all requests —
// that sharing IS the single-flight guarantee — WITHIN one process/isolate. Across instances (serverless/multi-pod) simultaneous refreshes can still race; the proactive isExpiringSoon window keeps that rare, it does not eliminate it.
const refreshSession = createSessionRefresher(board);

async function resolveSession(cookieHeader: string | null) {
  const session = parseSessionCookie(cookieHeader);
  if (!session) return { session: null, setCookie: null };
  if (!isExpiringSoon(session, Date.now())) {
    return { session, setCookie: null };
  }
  const next = await refreshSession(session);
  return next
    ? { session: next, setCookie: serializeSessionCookie(next) }
    : { session: null, setCookie: clearSessionCookie() }; // burned/revoked → signed out
}
```

The contract: a rotated `BoardSession` on success (write it back to the
cookie), `null` on a 401 (the token is burned or the session revoked —
clear the cookie and continue signed out, **never retry**), and anything
else (network error, 5xx, 429) rethrows for your error handling. Calls with
the SAME refreshToken while one rotation is in flight await that same
rotation; after it settles, the next call starts fresh.

Pass the access token per SDK call — the client itself stays stateless:

```ts snippet
const me = await board.me.retrieve(undefined, {
  headers: { authorization: `Bearer ${session.accessToken}` },
});
```

## The board-password grant cookie

On password-protected boards, `board.password.verify({ password })` returns
an HMAC grant token; gated reads take it as the `X-Board-Access` header.
Same codec pattern, 24-hour cookie (hosted parity):

```ts snippet
import {
  clearGrantCookie,
  parseGrantCookie,
  serializeGrantCookie,
} from '@cavuno/board/server';

const { token } = await board.password.verify({ password });
setCookieHeader = serializeGrantCookie(token);

// Thread it to gated reads:
const grant = parseGrantCookie(request.headers.get('cookie'));
const jobs = await board.jobs.list(undefined, {
  headers: grant ? { 'X-Board-Access': grant } : {},
});
```

When a read still fails with `isBoardPasswordRequired` (grant expired or
the password rotated), send the visitor to your `/password` page and clear
the stale cookie with `clearGrantCookie()`.

## Open-redirect guards

The `/password?redirect=` round-trip is the classic open-redirect hole.
`safeRedirectPath` transcribes the hosted board's guard (tested
against it): same-origin absolute paths pass through, everything else —
`//evil.com`, full URLs, `javascript:`, backslash and control-character
normalization bypasses — collapses to `'/'`.

```ts snippet
import {
  currentPathFromReferer,
  safeRedirectPath,
} from '@cavuno/board/server';

// Where to send the visitor after a correct password:
redirect(safeRedirectPath(query.redirect));

// Building the challenge link: derive the come-back path from the Referer
// your framework read for you (already guarded internally).
const backTo = currentPathFromReferer(request.headers.get('referer'));
redirect(`/password?redirect=${encodeURIComponent(backTo)}`);
```

## Thread derivations (core entry, not /server)

The messaging thread's pure rules ship on the main entry — they're
client-safe view logic, not server plumbing:

```ts snippet
import { isColdRule, isOwnMessage, lastOwnMessageId } from '@cavuno/board';

const mine = isOwnMessage(message, counterpartyId); // bubble side + actions
const composerLocked = isColdRule(messages, counterpartyId); // cold-message cap
const seenTargetId = lastOwnMessageId(messages, counterpartyId); // "Seen" row
```

`isColdRule` mirrors the server gate (`messaging_cold_rule` 403) so the
composer can disable itself instead of surfacing the error — the server
stays authoritative.

## Multi-board origins

One origin serving MULTIPLE boards must scope its cookies and storage per
board — otherwise one board's login clobbers another's (hosted scopes its
grant cookie per account for exactly this reason). Pass the board
identifier to the codecs; the browser storage modes scope automatically via
`createBoardClient`'s own `board`:

```ts snippet
import {
  serializeSessionCookie,
  parseSessionCookie,
  sessionCookieName,
} from '@cavuno/board/server';

const scope = { board: 'pk_boardA' };
const cookie = serializeSessionCookie(session, scope);
const restored = parseSessionCookie(cookieHeader, scope);
```

Single-board deployments (one board per hostname — the starter model) omit
the scope; the cookie names stay stable.

## Anti-patterns

```ts no-check
// NEVER auto-retry a null refresh — the token is single-use; a retry loop
// hammers the API with burned tokens:
while (!(await refreshSession(session))) {} // wrong

// NEVER create a refresher per request — per-request instances can't
// dedupe, which defeats the single-flight design:
const refreshSession = createSessionRefresher(board); // must be module scope

// NEVER redirect to the raw query param:
redirect(query.redirect); // open redirect — use safeRedirectPath

// NEVER put the session in auth.storage on the server — auth.refresh persists the rotated pair into client.storage, so a shared persistent store bleeds one user's tokens into other requests (cross-user session leak). 'nostore' + per-call headers is the contract — a shared instance
// leaks one user's tokens into another's request. Cookie + per-call header.
```

## Checklist

- [ ] Session cookie parsed on every request; `null` treated as signed out.
- [ ] `createSessionRefresher` instance is module-scoped (shared across
      requests) and its `null` result clears the cookie without retrying.
- [ ] Rotated sessions are written back with `serializeSessionCookie`.
- [ ] Every `?redirect=` consumer goes through `safeRedirectPath`.
- [ ] Bearer tokens ride per-call headers; the shared client has no storage.
