---
name: cavuno-board-auth
description: Authenticate board users with the @cavuno/board SDK — register, login, refresh, logout, email verification and password reset. Covers bearer-JWT storage modes, the deliberate no-auto-refresh-on-401 rule (and single-flight handling), and the server-side httpOnly-cookie pattern that keeps tokens out of the browser.
---

# Board-user authentication

Board users (candidates, employers) authenticate with a short-lived bearer access token plus a refresh token. The SDK manages the pair via pluggable async storage. There is exactly one auth mode — bearer JWT (no cookie/session mode).

## When to use

- Sign-up / sign-in / sign-out for board users.
- Email verification and password reset flows.
- Wiring authenticated calls (`me`, saved jobs, applications).

## When not to use

- Anonymous reads (jobs/companies/blog) — no auth needed.
- Board-password gating — that's a separate grant; see `cavuno-board-errors`.

## Register and login

```ts snippet
await board.auth.register({
  role: 'candidate',
  method: 'emailpass',
  email: 'ada@example.com',
  password: 'a-strong-password',
  displayName: 'Ada',
});

const session = await board.auth.login({
  email: 'ada@example.com',
  password: 'a-strong-password',
});
session.boardUser.email; // the signed-in user
session.accessToken;     // bearer; never expose to the browser bundle on SSR
```

`register`/`login`/`refresh` persist the returned token pair to storage; `logout` clears it. The SDK never navigates — your app owns redirects and verification UX.

## Storage modes

`auth.storage` is `'memory'` | `'nostore'` | `'local'` | `'session'` | a `CustomStorage`. Defaults: **`memory` in the browser, `nostore` on the server**. Browser login works out of the box; shared SSR instances stay stateless.

```ts
import { createBoardClient } from '@cavuno/board';

// Browser/SPA: 'local' persists the pair across tabs + reloads via
// localStorage; 'session' scopes it to the tab; 'memory' drops it on reload.
const board = createBoardClient({
  board: 'pk_a8f3...',
  auth: { storage: 'local' },
});
```

`'local'`/`'session'` are **browser-only** — off-browser they throw loudly at client creation (`storage mode 'local' is browser-only — use 'nostore' + per-call headers on the server`). A `CustomStorage` implements async `getItem`/`setItem`/`removeItem` — back it with IndexedDB, Redis, or your own store.

## No auto-refresh on 401 — handle it explicitly

An expired access token surfaces as a `BoardApiError` you detect with `isUnauthorized`. The SDK does **not** silently refresh — refresh tokens are single-use with atomic rotation, so safe refresh under concurrency needs a single-flight guard you own.

```ts snippet
import { isUnauthorized } from '@cavuno/board';

try {
  return await board.me.retrieve();
} catch (err) {
  if (isUnauthorized(err)) {
    await board.auth.refresh(); // reads the stored refresh token, rotates the pair
    return await board.me.retrieve();
  }
  throw err;
}
```

Under concurrency, wrap `auth.refresh()` in a single-flight promise so parallel 401s trigger exactly one rotation (the reference flavor encodes this once — see `cavuno-board-tanstack-start`).

## refresh / logout token sourcing

Both accept an optional body `{ refreshToken }`. When omitted, the SDK reads the token from storage and throws if neither exists — so `nostore` (server) callers must pass it explicitly:

```ts snippet
await board.auth.refresh({ refreshToken });   // server: explicit
await board.auth.logout({ refreshToken });    // revokes server-side, clears storage
```

## Server-side pattern (keep tokens out of the browser)

On SSR, do not hold the session on a shared instance. Keep the token pair in an httpOnly cookie owned by your app and pass it per call. `@cavuno/board/server` ships the cookie codec + the single-flight refresh helper for exactly this (see `cavuno-board-server`):

```ts snippet
// `accessToken` comes from your httpOnly cookie, read in server code.
// Per-call options are the 2nd argument; the 1st is `query` (pass undefined).
const me = await board.me.retrieve(undefined, {
  headers: { authorization: `Bearer ${accessToken}` },
});
```

## Email verification & password reset

```ts snippet
await board.auth.verifyEmail({ token });             // token from the email link
await board.auth.forgotPassword({ email });          // sends the reset email
await board.auth.resetPassword({ token, password }); // token from the email link
```

## Checklist

- [ ] Bearer tokens never reach the browser bundle on SSR (httpOnly cookie + per-call header).
- [ ] 401s handled explicitly with `isUnauthorized` + `auth.refresh()`.
- [ ] Concurrent refresh guarded by single-flight.
- [ ] `nostore` callers pass `{ refreshToken }` to `refresh`/`logout`.
