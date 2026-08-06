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

## Record marketing consent for the signed-in person

Marketing consent is a property of the board user, never a guest capture. The
frontend owns the checkbox wording and the privacy-policy link — render your
own copy beside the control; the API records the decision, not the prose.
Leave any checkbox unticked by default and call nothing while it stays
unticked: absence of a record means no consent, never a default.

At sign-up, pass the tick through the register body so consent is recorded in
the same transaction that creates the user:

```ts snippet
await board.auth.register({
  role: 'candidate',
  method: 'emailpass',
  email: form.email,
  password: form.password,
  displayName: form.displayName,
  marketingConsent: form.marketingChecked,
});
```

Later, read or change only the signed-in person's own consent through the
authenticated `me` namespace. There is intentionally no email parameter, so a
frontend cannot target another person. Withdrawal is always an explicit POST —
never a state-changing GET, which mail scanners would follow.

```ts snippet
const current = await board.me.marketingConsent.retrieve();
if (current?.status !== 'granted') {
  await board.me.marketingConsent.grant();
}
await board.me.marketingConsent.withdraw();
```

Call `grant()` only from a surface that displayed your disclosure wording.
Both calls are idempotent: repeating one changes nothing and emits no event.

**Complete when:** the checkbox defaults to unticked, unticked submits
nothing, grant is only reachable beside rendered disclosure copy, and
withdrawal is never implemented as a state-changing GET.

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
