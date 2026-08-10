# Cavuno Board SDK

Build custom job boards and careers pages with Cavuno’s TypeScript SDK.

`@cavuno/board` is the zero-dependency client for the Cavuno Board API. It
runs in browsers, Node.js 20 or newer, and Cloudflare Workers, with TypeScript
declarations generated from the API’s OpenAPI contract.

[Documentation](https://cavuno.com/docs/sdk) ·
[Installing](https://cavuno.com/docs/sdk/installing) ·
[SDK reference](https://cavuno.com/docs/sdk/reference) ·
[API reference](https://cavuno.com/docs/api) ·
[Source](https://github.com/wollemiahq/cavuno-sdk)

## Installation

### Install as package

```bash
npm install @cavuno/board
```

The package includes ESM and CommonJS builds. ESM imports are tree-shakeable,
and helper packages such as `@cavuno/board/format` can be imported separately.

### Install via CDN

No package manager or build step? Follow the
[CDN installation guide](https://cavuno.com/docs/sdk/installing/cdn)
for a version-pinned build and its integrity hash. The CDN build is
the same SDK downloaded as one file; package imports remain the recommended
choice when they are available.

See [Installing](https://cavuno.com/docs/sdk/installing) for every installation option.

## Quick start

```ts
import { createBoardClient } from '@cavuno/board';

const board = createBoardClient({
  board: 'pk_your_publishable_key',
});

const [context, jobs] = await Promise.all([
  board.context(),
  board.jobs.list({ limit: 20 }),
]);

console.log(context.name);
console.log(jobs.data);
```

A `pk_…` key identifies a board and is public by design. Get it from
**Settings → Developer → SDK** in Cavuno. The client connects to
`https://api.cavuno.com` by default.

The client exposes typed namespaces for jobs and search, companies, salaries,
blog, board-user authentication, saved jobs, applications, job alerts,
messaging, employer workflows, checkout, candidate access, and SEO data.

## Handle errors

Every non-2xx response throws a `BoardApiError` with the API status, code,
details, and request ID.

```ts
import { BoardApiError, isNotFound } from '@cavuno/board';

try {
  await board.jobs.retrieve('missing-job');
} catch (error) {
  if (isNotFound(error)) {
    // Render your application's not-found state.
  } else if (error instanceof BoardApiError) {
    console.error(error.code, error.requestId);
  }
}
```

See [Handle SDK errors](https://cavuno.com/docs/sdk/fundamentals/errors) for
the complete error contract and guards.

## Authentication

- A `pk_…` publishable key identifies the board and may be included in browser
  code.
- Candidate and employer sessions use `board.auth.*`. Choose browser storage
  deliberately; server-rendered applications should keep sessions in their
  own httpOnly cookies.
- Operator and admin credentials must never be used with this SDK or exposed
  to frontend code.

Read [Authentication and sessions](https://cavuno.com/docs/sdk/fundamentals/authentication-and-session-ownership)
before adding signed-in workflows.

## Make a request to a custom endpoint

For an endpoint without a namespace method, `board.client.fetch<T>(path, init)`
uses the same board base path, headers, bearer token, serialization, and hooks
as the rest of the client. Treat the generic response type as your
application’s assertion; custom responses are not generated from the public
OpenAPI contract.

See [`board.client.fetch()`](https://cavuno.com/docs/sdk/reference/top-level-methods#make-a-request-to-a-custom-endpoint)
for options and examples.

## Set up with a coding agent

The package includes version-matched Agent Skills for Codex, Claude Code,
Cursor, and other compatible coding agents:

```bash
npx @cavuno/board setup
```

Then ask your agent to set up the Cavuno board using the installed
`cavuno-board-setup` skill. See
[Set up with an agent](https://cavuno.com/docs/sdk/installing/agent)
for the review and verification workflow.

## Resources

- [SDK guides and reference](https://cavuno.com/docs/sdk)
- [Board API documentation](https://cavuno.com/docs/api)
- [OpenAPI document](https://api.cavuno.com/v1/openapi.json)
- [Source](https://github.com/wollemiahq/cavuno-sdk)
- [Issues](https://github.com/wollemiahq/cavuno-sdk/issues)
- [TanStack Start + shadcn/ui job board template](https://github.com/wollemiahq/cavuno-tanstack-start-shadcn-job-board-template)

MIT © Wollemia
