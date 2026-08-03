---
name: cavuno-board-errors
description: Classify Board API failures and board-password challenges. Use when mapping SDK errors to UI states, retries, support diagnostics, or password-gated access.
---

# Handle errors and access gates

Every non-2xx SDK response throws `BoardApiError`. Branch on its typed guards and codes; messages remain presentation text rather than control flow.

## Error contract

```ts no-check
class BoardApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;
  raw: unknown;
}
```

Use the narrowest matching guard, render its domain state, and rethrow unmatched failures:

```ts snippet
import {
  isBoardApiError,
  isNotFound,
  isRateLimited,
  isUnauthorized,
  isValidationError,
} from '@cavuno/board';

try {
  return await board.jobs.retrieve('senior-chef');
} catch (error) {
  if (isNotFound(error)) return null;
  if (isUnauthorized(error)) return showSignIn();
  if (isValidationError(error)) return showFieldErrors(error.details);
  if (isRateLimited(error)) return scheduleRetry();
  if (isBoardApiError(error)) {
    console.error(error.code, error.requestId);
  }
  throw error;
}
```

The remaining status guards are `isForbidden` for 403 and `isConflict` for 409. Record `code` and `requestId` in support diagnostics. Because v1 may add error codes, unmatched `BoardApiError` instances still need a safe generic state.

**Complete when:** every expected failure has one typed branch, an invalid resource renders not-found, and unmatched failures retain their original error.

## Board-password challenge

`isBoardPasswordRequired` distinguishes the `board_password_required` 401 from an expired board-user session. Exchange the visitor's password once; browser storage then attaches the returned grant as `X-Board-Access` on later reads.

```ts snippet
import { isBoardPasswordRequired } from '@cavuno/board';

try {
  return await board.jobs.list({ limit: 20 });
} catch (error) {
  if (!isBoardPasswordRequired(error)) throw error;
  await board.password.verify(userEnteredPassword);
  return board.jobs.list({ limit: 20 });
}
```

The grant is board access, not a user session. Server-rendered apps keep it in the app-owned grant cookie and pass it per request; `cavuno-board-server-sessions` defines that cookie and redirect contract. A fresh `board_password_required` response means the grant expired or the password rotated, so return to the challenge flow.

**Complete when:** a valid password unlocks one retry, an invalid password renders its typed error, and a stale server grant is cleared before rechallenge.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
