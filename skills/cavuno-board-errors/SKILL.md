---
name: cavuno-board-errors
description: Handle errors and access gating with the @cavuno/board SDK — the BoardApiError shape, the typed guards (isNotFound, isUnauthorized, isValidationError, isRateLimited, isForbidden, isConflict), and the board-password flow (isBoardPasswordRequired → password.verify → X-Board-Access grant).
---

# Errors and access gating

Every SDK method throws on a non-2xx response. The error keeps the server's full typed envelope — never string-match messages.

## When to use

- Branching on failures (not found, unauthorized, validation, rate limit).
- Unlocking a password-protected board.

## The BoardApiError shape

```ts no-check
class BoardApiError extends Error {
  status: number;
  code: string;        // `<domain>_<snake_reason>`
  details?: unknown;    // structured, per-code
  requestId?: string;
  raw: unknown;         // parsed body, untouched
}
```

## Branch with the typed guards

```ts snippet
import {
  isBoardApiError,
  isNotFound,
  isUnauthorized,
  isValidationError,
  isRateLimited,
  isForbidden,
  isConflict,
} from '@cavuno/board';

try {
  return await board.jobs.retrieve('senior-chef');
} catch (err) {
  if (isNotFound(err)) return null;          // 404 → render not-found
  if (isUnauthorized(err)) {                  // 401 → refresh or sign in
    /* see cavuno-board-auth */
  }
  if (isValidationError(err)) {               // 400 validation_bad_request → field errors in err.details
  }
  if (isRateLimited(err)) {                    // 429 → back off
  }
  if (isBoardApiError(err)) {
    console.error(err.code, err.requestId);    // log code + requestId for support
  }
  throw err;
}
```

`isForbidden` (403) and `isConflict` (409) round out the set. Use `err.requestId` in support reports.

## Password-protected boards

A gated board answers reads with `isBoardPasswordRequired` until the visitor presents a grant. Exchange the password once with `password.verify()`; the SDK stores the grant and attaches it as `X-Board-Access` on every subsequent read automatically.

```ts snippet
import { isBoardPasswordRequired } from '@cavuno/board';

try {
  await board.jobs.list({ limit: 20 });
} catch (err) {
  if (isBoardPasswordRequired(err)) {
    await board.password.verify(userEnteredPassword); // stores the grant
    await board.jobs.list({ limit: 20 });             // now passes the wall
  } else {
    throw err;
  }
}
```

The grant is identical for every visitor of the board and is not a user session. On SSR (`nostore`), pass it per call as `{ headers: { 'x-board-access': grant } }` instead of relying on stored state.

## Checklist

- [ ] Failures branched via guards, never message string-matching.
- [ ] `404` → handled not-found path (not a crash).
- [ ] `err.requestId` logged for support.
- [ ] Password-gated boards call `password.verify()` on `isBoardPasswordRequired`.
