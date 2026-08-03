---
name: cavuno-board-auth
description: Authenticate Cavuno board users. Use for registration, login, logout, token refresh, email verification, password recovery, magic links, OAuth, or authenticated board-user calls.
---

# Authenticate board users

Board users authenticate with a short-lived bearer access token and a single-use refresh token. The SDK persists returned token pairs through its configured async storage and leaves navigation to the app.

## 1. Choose the storage boundary

`auth.storage` accepts `'memory'`, `'local'`, `'session'`, `'nostore'`, or a `CustomStorage` with async `getItem`, `setItem`, and `removeItem` methods.

- Browsers default to `'memory'`; choose `'local'` for persistence across tabs and reloads or `'session'` for tab-scoped persistence.
- Servers default to `'nostore'`. Keep tokens in the app's httpOnly cookie and follow `cavuno-board-server-sessions` for every SSR session and refresh rule.
- A custom store is appropriate when the app already owns a user-scoped persistence boundary.

`'local'` and `'session'` are browser runtimes; constructing them off-browser fails immediately.

**Complete when:** the selected store matches the runtime and a shared server client remains `nostore`.

## 2. Establish the session

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
```

`register`, `login`, `consumeMagicLink`, `exchangeOAuth`, and `refresh` persist the returned session. Use the returned `boardUser` for identity and verification state.

For alternate entry points, use `requestMagicLink` / `consumeMagicLink` or the OAuth authorization and exchange methods exposed under `board.auth`.

**Complete when:** the chosen entry flow returns a session and `board.me.retrieve()` resolves as that board user.

## 3. Handle expiry explicitly

The SDK surfaces an expired access token as `BoardApiError`; it does not refresh and replay a failed request automatically. In a browser app, classify the failure with `isUnauthorized`, serialize refresh through one in-flight promise, then retry the original operation once with the rotated session.

```ts snippet
import { isUnauthorized } from '@cavuno/board';

try {
  return await board.me.retrieve();
} catch (error) {
  if (!isUnauthorized(error)) throw error;
  await refreshOnce();
  return board.me.retrieve();
}
```

On SSR, use the module-scoped `createSessionRefresher` pattern in `cavuno-board-server-sessions`; it is the single source of truth for concurrency, cookies, retry limits, and per-call authorization headers.

**Complete when:** concurrent expiry paths share one rotation and the original operation is attempted at most once after a successful refresh.

## 4. Refresh and logout from the right source

`refresh()` and `logout()` read the refresh token from configured storage when their body is omitted. A `nostore` caller passes it explicitly:

```ts snippet
await board.auth.refresh({ refreshToken });
await board.auth.logout({ refreshToken });
```

Successful logout revokes the refresh token and clears SDK storage. A failed logout request retains stored tokens so the app can retry revocation or deliberately choose a local-only sign-out.

**Complete when:** logout revokes the server session, clears the app-owned cookie or browser store, and an authenticated read is handled as signed out.

## Verification and recovery

```ts snippet
await board.auth.verifyEmail({ token });
await board.auth.forgotPassword({ email: 'ada@example.com' });
await board.auth.resetPassword({ token, password: 'a-new-password' });
```

The signed-in OTP verification, resend, magic-link, and OAuth branches use their corresponding `board.auth` methods. Password-reset requests preserve account privacy; a successful single-use reset invalidates existing sessions.

**Complete when:** each implemented auth route exercises its success state and typed failure state, with bearer tokens absent from server-rendered browser payloads.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
