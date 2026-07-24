---
name: cavuno-board-tanstack-start
description: TanStack-Start-on-Cloudflare-Workers reference wiring for a headless Cavuno board — SSR loaders calling @cavuno/board server-side, the session held in an __Host- httpOnly cookie owned by the app, a single-flight refresh helper, and FetchOptions cache passthrough on Workers.
---

# Reference flavor: TanStack Start on Cloudflare Workers

This is the framework-specific layer for the reference starter (`wollemiahq/cavuno-board-starter`). The core skills (`cavuno-board-client`, `-jobs`, `-auth`, `-errors`) define the SDK surface; this skill shows how to wire it into TanStack Start on Workers. Read the core skills first.

## When to use

- The project depends on `@tanstack/react-start`.
- You need the SSR-loader + httpOnly-cookie + single-flight-refresh patterns.

## One shared, stateless client

```ts
import { createBoardClient } from '@cavuno/board';

// Module-scoped, no auth.storage → safe across concurrent Workers requests.
export const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
});
```

## Read in server loaders; cache via FetchOptions

Call the SDK only on the server (route loaders / server functions), never from the browser with a token. On Workers, pass cache directives straight through:

```ts no-check
import { createFileRoute } from '@tanstack/react-start';
import { board } from '~/lib/board';

export const Route = createFileRoute('/jobs')({
  loader: async () => {
    // `cf` rides straight to the Workers fetch — the SDK needs no framework knowledge.
    return board.jobs.list({ limit: 20 }, { cf: { cacheTtl: 60 } } as never);
  },
});
```

## Session in an `__Host-` httpOnly cookie owned by the app

The SDK never owns the cookie. Store the bearer pair in an `__Host-`-prefixed httpOnly cookie set by your server functions, read it on each request, and pass the token per call:

```ts no-check
import { board } from '~/lib/board';
import { readSessionCookie } from '~/lib/session.server';

export async function loadMe(request: Request) {
  const { accessToken } = readSessionCookie(request);
  // Pass the token via `options` (2nd arg). The 1st arg is `query`.
  return board.me.retrieve(undefined, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}
```

## Single-flight refresh

Refresh tokens are single-use; concurrent 401s must trigger exactly one rotation. Encode it once and reuse everywhere:

```ts no-check
import { isUnauthorized } from '@cavuno/board';
import { board } from '~/lib/board';

let inflight: Promise<void> | null = null;

// `getAccessToken`/`getRefreshToken` read your __Host- cookie (the SDK never
// touches it). On a 401 we refresh exactly once — concurrent callers await the
// same `inflight` promise — then retry `run` with the rotated token. Your
// refresh handler must write the new pair to the cookie so the retry reads it.
export async function withFreshSession<T>(
  getAccessToken: () => string,
  getRefreshToken: () => string,
  run: (accessToken: string) => Promise<T>): Promise<T> {
  try {
    return await run(getAccessToken());
  } catch (err) {
    if (!isUnauthorized(err)) throw err;
    inflight ??= board.auth
      .refresh({ refreshToken: getRefreshToken() })
      .then(() => undefined)
      .finally(() => (inflight = null));
    await inflight;
    return run(getAccessToken()); // retry with the rotated token
  }
}
```

## Canonical URLs

Mirror the hosted board's public URLs so indexed links survive a hosted → headless migration: job detail at `/companies/$companySlug/jobs/$jobSlug`, listings at `/jobs`, `/jobs/$keyword`, `/jobs/locations/$slug`.

## Checklist

- [ ] All SDK calls are server-side; no bearer token in the browser bundle.
- [ ] Session in an `__Host-` httpOnly cookie owned by the app, passed per call.
- [ ] Single-flight refresh wraps concurrent 401s.
- [ ] Public route paths mirror the hosted board's canonical URLs.
