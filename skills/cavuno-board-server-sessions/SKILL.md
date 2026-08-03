---
name: cavuno-board-server-sessions
description: Wire Cavuno server sessions and board-password access. Use when a server-rendered app needs httpOnly cookies, per-request bearer headers, single-flight refresh, grant cookies, or safe redirect-back handling.
---

# Wire server sessions

`@cavuno/board/server` provides platform-neutral cookie strings and refresh coordination. The framework skills installed in the app provide request, middleware, and response APIs.

The server contract has three invariants:

1. One module-scoped board client uses server-default `nostore`.
2. Each request reads an app-owned httpOnly cookie and passes credentials in that call's headers.
3. One module-scoped `createSessionRefresher(board)` coordinates refreshes within the process or isolate.

## 1. Persist the board-user session

`BoardSession` contains `{ accessToken, refreshToken, expiresAt }`. The codec uses one `__Host-` cookie with `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, and a 30-day `Max-Age`. The framework owns header I/O and CSRF controls; wrap the codec when the app requires cookie encryption.

```ts snippet
import {
  clearSessionCookie,
  parseSessionCookie,
  serializeSessionCookie,
} from '@cavuno/board/server';

const signedIn = await board.auth.login({ email, password });
const setCookie = serializeSessionCookie({
  accessToken: signedIn.accessToken,
  refreshToken: signedIn.refreshToken,
  expiresAt: signedIn.expiresAt,
});

const session = parseSessionCookie(request.headers.get('cookie'));
const clearedCookie = clearSessionCookie();
```

`parseSessionCookie` returns `null` for absent, malformed, or wrong-shaped values. Treat that state as signed out. On logout, call `board.auth.logout({ refreshToken })`, then emit `clearSessionCookie()` after successful revocation.

**Complete when:** login emits the serialized cookie, the next server request restores the same session, malformed input becomes signed out, and logout expires the cookie.

## 2. Resolve one fresh session per request

Refresh tokens rotate once. Create the refresher beside the shared client so concurrent requests using the same refresh token await one rotation. `isExpiringSoon` selects sessions within the proactive five-minute window.

```ts snippet
import {
  clearSessionCookie,
  createSessionRefresher,
  isExpiringSoon,
  parseSessionCookie,
  serializeSessionCookie,
} from '@cavuno/board/server';

const refreshSession = createSessionRefresher(board);

async function resolveSession(cookieHeader: string | null) {
  const session = parseSessionCookie(cookieHeader);
  if (!session) return { session: null, setCookie: null };
  if (!isExpiringSoon(session, Date.now())) {
    return { session, setCookie: null };
  }

  const rotated = await refreshSession(session);
  return rotated
    ? { session: rotated, setCookie: serializeSessionCookie(rotated) }
    : { session: null, setCookie: clearSessionCookie() };
}
```

A rotated session is written back before the response completes. A `null` result represents a 401 from a burned or revoked token: clear the cookie and continue signed out. Network, 5xx, and 429 failures rethrow to the app's error boundary. The helper deduplicates within one process or isolate; separate deployment instances can still race.

**Complete when:** two simultaneous resolutions for one expiring session invoke one rotation in the process, both observe the same result, success writes the rotated pair, and `null` produces one clear-cookie response with no refresh retry.

## 3. Authenticate each SDK call

Pass the resolved access token in the call's trailing `FetchOptions`:

```ts snippet
const me = await board.me.retrieve(undefined, {
  headers: { authorization: `Bearer ${session.accessToken}` },
});
```

This keeps the shared client's storage empty across users.

**Complete when:** concurrent requests can present different tokens without mutating the shared client.

## 4. Persist board-password access

The board-password grant has its own 24-hour `__Host-` cookie. It remains separate from the board-user session.

```ts snippet
import {
  clearGrantCookie,
  parseGrantCookie,
  serializeGrantCookie,
} from '@cavuno/board/server';

const { token } = await board.password.verify(password);
const setGrantCookie = serializeGrantCookie(token);

const grant = parseGrantCookie(request.headers.get('cookie'));
const jobs = await board.jobs.list(undefined, {
  headers: grant ? { 'X-Board-Access': grant } : {},
});

const clearedGrantCookie = clearGrantCookie();
```

When a read returns `isBoardPasswordRequired`, clear the stale grant and route the visitor through the password challenge again.

**Complete when:** verification writes the grant, a later request supplies `X-Board-Access`, and an expired or rotated grant is cleared before rechallenge.

## 5. Guard redirect-back paths

Every password challenge and post-login redirect consumes a same-origin absolute path through `safeRedirectPath`. `currentPathFromReferer` derives an already-guarded return path from a Referer header.

```ts snippet
import {
  currentPathFromReferer,
  safeRedirectPath,
} from '@cavuno/board/server';

const destination = safeRedirectPath(query.redirect);
const returnTo = currentPathFromReferer(request.headers.get('referer'));
```

Values that could resolve off-origin collapse to `/` (or the explicit fallback passed as the second argument).

**Complete when:** raw query values never reach the redirect API and tests cover a valid local path, a full URL, a protocol-relative URL, backslashes, and control-character normalization.

## Multi-board origins

When one origin serves multiple boards, pass the board identifier to every session and grant codec so cookies cannot collide:

```ts snippet
const scope = { board: 'pk_boardA' };
const cookie = serializeSessionCookie(session, scope);
const restored = parseSessionCookie(cookieHeader, scope);
```

Single-board origins omit the scope.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
