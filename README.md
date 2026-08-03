# Cavuno Board SDK

Build custom job boards and careers pages with Cavuno’s TypeScript SDK.

`@cavuno/board` is a typed, isomorphic client for the
[Cavuno job board platform](https://cavuno.com) Board API. It has zero runtime
dependencies and runs in browsers, Node.js 20 or newer, and Cloudflare Workers.

You bring the framework and own the layout; the SDK brings the job board:
jobs and search, companies, salaries, blog, board-user auth, saved jobs,
applications, job alerts, messaging, employer self-service, checkout, and
the candidate paywall — every method typed from the API's own OpenAPI
contract.

## Building with a coding agent

The package ships an Agent Skills corpus for Codex, Claude Code, Cursor, and
other compatible coding agents. It teaches them how to wire a board correctly — client setup,
auth and session ownership, pagination, gating, error handling, and a
runtime smoke test:

```bash
npm install @cavuno/board     # or: pnpm add / yarn add / bun add
npx @cavuno/board setup       # copies version-matched Agent Skills
```

Then ask your agent: *"set up my Cavuno board"* — it reads the
`cavuno-board-setup` skill and works surface by surface. Because the
skills live in your project and match your installed version, the agent
never works from stale docs.

## Quick start (by hand)

```ts
import { createBoardClient } from '@cavuno/board';

const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!, // pk_… publishable key
});

const { name, language, features } = await board.context();
const page = await board.jobs.list({ limit: 20 });
const job = await board.jobs.retrieve('senior-chef');

// Federated search-dropdown suggestions (companies + taxonomy terms).
const { items } = await board.search.suggest({ q: 'acme', limit: 10 });
// Or the headless controller (debounce / abort / stale-drop built in):
// import { createSuggestController } from '@cavuno/board/suggest';
// const suggest = createSuggestController(board);
// suggest.setQuery('acme');
```

Every method accepts trailing `FetchOptions` — `signal`, `headers`, and
framework caching directives (`next: { tags }`, `cf: {…}`) pass through to
`fetch` untouched. Walk full catalogs with the async iterator:

```ts
import { paginate } from '@cavuno/board';

// the query `limit` is the page size; toArray's `limit` caps items collected
for await (const card of paginate(board.jobs.list, { limit: 100 })) {
  urls.push(card.links.public);
}
const first500 = await paginate(board.companies.list, { limit: 100 })
  .toArray({ limit: 500 });
```

Errors are typed — every non-2xx throws a `BoardApiError` carrying the full
v1 envelope (`status`, `code`, `details`, `requestId`), with guards like
`isNotFound`, `isRateLimited`, and `isBoardPasswordRequired`.

## Auth model

Three tiers, safe for browsers by construction:

- **`pk_…` publishable key** — identifies the board; public by design.
- **Board-user JWT** — candidate/employer sessions via `board.auth.*`.
  Pluggable storage (`memory` in the browser, `nostore` on the server);
  on SSR, keep the session in an httpOnly cookie your app owns and pass
  the token per call. No auto-refresh on 401 — rotation is explicit.
- **No secret keys** — operator/admin credentials never touch this SDK.

## Escape hatch

`board.client.fetch<T>(path, init)` sends a typed request through the full
pipeline (board base path, headers, bearer token, hooks) for endpoints the
SDK doesn't cover yet.

## Docs

- Cavuno: <https://cavuno.com>
- SDK guides and reference: <https://cavuno.com/docs/sdk>
- API documentation: <https://cavuno.com/docs/api>
- OpenAPI document: `GET https://api.cavuno.com/v1/openapi.json`
- Source: <https://github.com/wollemiahq/cavuno-sdk>
- Issues: <https://github.com/wollemiahq/cavuno-sdk/issues>
- Clone-and-own TanStack Start + shadcn/ui template:
  <https://github.com/wollemiahq/cavuno-tanstack-start-shadcn-job-board-template>

MIT © Wollemia
