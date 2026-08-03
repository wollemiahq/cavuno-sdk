---
name: cavuno-board-api-client
description: Configure the @cavuno/board API client. Use when creating the shared client, adding global hooks or headers, passing framework fetch options, or calling an endpoint through the typed escape hatch.
---

# Configure the Board API client

Create one client and keep its shared state board-scoped, not user-scoped.

## Create the shared client

```ts
import { createBoardClient } from '@cavuno/board';

export const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
});
```

The `board` option accepts a `pk_…` key, `boards_…` ID, or slug. Prefer the immutable, publishable `pk_…` key for deployed frontends. The client defaults to `https://api.cavuno.com`; use `baseUrl` only for a Cavuno-supplied alternate origin.

**Complete when:** the app imports one reused client and `board.context()` identifies the expected board.

## Configure the request pipeline

Every namespace uses the same pipeline: board base path, global headers, stored browser credentials, request/response hooks, and per-call options.

```ts no-check
const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
  globalHeaders: { 'Accept-Language': 'en' },
  onRequest: async (request) => request,
  onResponse: async (response, request) => {
    console.info(request.url, response.status);
  },
  logger: console,
});
```

Use `onRequest` to replace or adjust the request. Use `onResponse` for observation; it receives a response clone, so reading it leaves SDK parsing intact.

**Complete when:** cross-cutting behavior is expressed once in client configuration and a request proves the hook or header is active.

## Pass runtime state per call

Every method accepts a trailing `FetchOptions`: `RequestInit` without `body`, plus `query`. Fetch-native and framework-specific fields pass through unchanged.

```ts snippet
await board.jobs.list(
  { limit: 20 },
  { next: { revalidate: 60, tags: ['jobs'] } });

const controller = new AbortController();
await board.jobs.list(
  { limit: 20 },
  { cache: 'force-cache', signal: controller.signal });
```

A module-scoped client is safe for concurrent SSR requests when it uses the server default `nostore` and each request supplies its own bearer or grant headers. `cavuno-board-server-sessions` is the authority for that session pattern. Browser persistence belongs to `cavuno-board-auth`.

**Complete when:** a shared server client contains no per-user state and each authenticated request supplies its own headers.

## Use the escape hatch for an untyped endpoint

`board.client.fetch<T>(path, options)` keeps the full request pipeline while providing a response type locally.

```ts snippet
const data = await board.client.fetch<{
  object: 'list';
  data: unknown[];
}>('/some-new-endpoint', { query: { limit: 5 } });
```

**Complete when:** the call uses a board-relative path, supplies an honest response type, and no parallel raw-fetch client was introduced.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
