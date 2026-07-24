---
name: cavuno-board-client
description: Create and configure the @cavuno/board client — the pk_ board identifier, optional API-origin override, global headers, hooks, per-call FetchOptions, and the rule that keeps one shared instance safe under SSR.
---

# The Board API client

`createBoardClient` returns a typed client whose namespaces (`jobs`, `companies`, `blog`, `auth`, `me`, …) all route through one request pipeline: board-identifier base path, default headers, bearer token from storage, and your hooks.

## When to use

- Creating the client instance your whole app shares.
- Adding global headers, logging, request/response hooks, or framework caching.
- Calling an endpoint the SDK doesn't expose yet (`client.fetch`).

## When not to use

- Per-surface usage (listing jobs, auth) — see the surface skills; they assume the client exists.

## Create the client

```ts
import { createBoardClient } from '@cavuno/board';

const board = createBoardClient({
  board: 'pk_a8f3...', // pk_ key (preferred) | boards_ id | slug
});
```

Use the `pk_…` publishable key for `board`, not the slug: the slug is operator-mutable and renames break deployed frontends. The `pk_…` key is immutable and client-safe.

## Configuration

```ts no-check
const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
  globalHeaders: { 'Accept-Language': 'en' },
  onRequest: async (req) => req,          // mutate/replace the request (locale, URL rewrite)
  onResponse: async (res, req) => {},     // side effects only (logging, analytics)
  logger: console,
  auth: { storage: 'memory' },            // see cavuno-board-auth
});
```

The `onRequest`/`onResponse` hooks are first-class — do not monkey-patch the client. `onResponse` receives a **clone** of the response, so reading its body never disturbs the SDK's own parsing.

## Per-call FetchOptions ride straight to fetch

Every method takes a trailing `options?` of type `FetchOptions` (`Omit<RequestInit,'body'>` plus `query`). Anything besides `body`/`query` passes through to `fetch` untouched, so framework caching works with zero SDK knowledge:

```ts snippet
// Next.js ISR
await board.jobs.list({ limit: 20 }, { next: { revalidate: 60, tags: ['jobs'] } });
// Cloudflare Workers
await board.jobs.list({ limit: 20 }, { cf: { cacheTtl: 60 } } as never);
// Standard fetch + abort
const ac = new AbortController();
await board.jobs.list({ limit: 20 }, { cache: 'force-cache', signal: ac.signal });
```

## One shared instance is SSR-safe — if state stays per-call

A single Workers isolate serves many users at once. A module-scoped client is safe **only** while per-user state is passed per call (`options.headers`), not stored on the instance. For browser/SPA usage, the instance may hold the session (`auth.storage`); for SSR, keep the session in an httpOnly cookie and pass `{ headers: { authorization } }` per call (see `cavuno-board-auth`).

```ts
import { createBoardClient } from '@cavuno/board';

// Safe: shared, stateless. Per-user token rides per call.
export const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
});
```

## Escape hatch: client.fetch

`board.client.fetch<T>(path, init)` is public and first-class — it runs the full pipeline (base path, headers, token, hooks), not a raw `fetch`. Use it to call an endpoint before the SDK ships a typed method for it:

```ts snippet
const data = await board.client.fetch<{ object: 'list'; data: unknown[] }>(
  '/some-new-endpoint',
  { query: { limit: 5 } });
```

## Checklist

- [ ] One client created from env values, reused everywhere.
- [ ] `board` is the `pk_…` key, not the slug.
- [ ] No per-user state on a shared SSR instance.
- [ ] Caching done via per-call `FetchOptions`, not a wrapper.
