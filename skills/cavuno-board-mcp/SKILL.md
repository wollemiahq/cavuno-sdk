---
name: cavuno-board-mcp
description: Serve the board's public MCP server at /mcp with @cavuno/board/mcp, and let people sign in to it from their assistant. Use when connecting a self-hosted board to Claude, ChatGPT, Cursor or another MCP client, adding assistant sign-in or a consent page, or when /mcp or /mcp/docs returns 404 on the board's host.
---

# Board MCP server

Every paid Cavuno board has a public, read-only MCP server: AI assistants can
search its jobs, read job and company pages, and look up salaries. Boards that
Cavuno hosts serve it at `/mcp` on their own domain already. A self-hosted
board serves it by mounting `createMcpHandler` from `@cavuno/board/mcp`, which
forwards to the Board API, so the tools, limits and setup page match every
other Cavuno board.

## Mount the handler

Mount one handler at `/mcp`, `/mcp/*` and `/.well-known/ai-catalog.json`, for
GET, HEAD and POST. Pass
the board's publishable key: job and company links in tool results then point
at the key's own origin.

```ts snippet
import { createMcpHandler } from '@cavuno/board/mcp';

// app/mcp/[[...path]]/route.ts, and the same lines in
// app/.well-known/ai-catalog.json/route.ts
const handler = createMcpHandler({
  board: process.env.NEXT_PUBLIC_CAVUNO_BOARD_KEY!,
});
export const GET = handler;
export const HEAD = handler;
export const POST = handler;
```

Other frameworks mount the same `(request: Request) => Promise<Response>`
function on each path. Do not add authentication, cookies or caching in front
of `/mcp`: MCP clients POST without cookies, and with sign-in on they send
their own bearer token, which the handler forwards.

## Sign-in from assistants (self-hosted)

With `consentPath`, people can sign in to their own account on the board from
their assistant, on the site's own domain. Sign-in works only on origins the
board has registered in **Settings → SDK**: its self-hosted frontend domain
(the publishable key's origin) and its development origins, such as
`http://localhost:5173` or a preview URL.

```ts snippet
import { createMcpHandler } from '@cavuno/board/mcp';

// Mount at /mcp, /mcp/*, /.well-known/ai-catalog.json,
// /.well-known/oauth-protected-resource (and /mcp below it),
// /.well-known/oauth-authorization-server and /oauth/*,
// for GET, HEAD, POST and OPTIONS.
const handler = createMcpHandler({
  board: process.env.NEXT_PUBLIC_CAVUNO_BOARD_KEY!,
  consentPath: '/authorize',
});
```

- Every forward then names the site in `x-cavuno-mcp-site`
  (`MCP_SITE_HEADER`), the request URL's origin unless `siteOrigin` is set
  (set it when a proxy rewrites the host or scheme the handler sees).
  `POST /mcp` also forwards `Authorization`; a 401 `WWW-Authenticate`
  challenge passes through.
- The discovery documents and `POST /oauth/register`, `/oauth/token` and
  `/oauth/revoke` forward to the Board API; `OPTIONS` on them answers the
  browser preflight.
- `GET /oauth/authorize` redirects to `consentPath` with the query unchanged.
- Without `consentPath` those paths answer 404 and nothing extra is sent.
- `consentPath` needs `board` to be the publishable key, and must be a path
  on the site; otherwise `createMcpHandler` throws a `TypeError`.

## What each path answers

- `POST /mcp`: the stateless Streamable HTTP transport.
- `GET /mcp` from a browser: a redirect to `/mcp/docs`. Any other non-POST
  request answers 405.
- `GET /mcp/docs`: an HTML page listing the tools and how to add the server
  to each assistant. Use this URL as the documentation link in a Claude or
  ChatGPT directory submission.
- `GET /mcp/server-card`: the MCP Server Card, the server's name, version,
  title, icons and URL as `application/mcp-server-card+json`, for an
  assistant to read before it connects.
- `GET /.well-known/ai-catalog.json`: the AI Catalog, which lists the Server
  Card so an assistant that knows only the board's domain can find the server.

A free-plan board, a password-protected board, or a board whose operator has
switched the server off answers 404 on every path.

## Limits

The Board API allows 1,000 MCP requests a minute per visitor address. Requests
forwarded from a self-hosted server arrive from that server's address, so the
limit applies to the board's MCP traffic as a whole. Over the limit, `/mcp`
answers 429 with `Retry-After`.

## The consent page

An assistant starts sign-in at the board's `/oauth/authorize`, which sends the
browser to the site's consent page with the sign-in request in the query. On
a self-hosted site that is `consentPath`. On a live Cavuno Builder site, a
page that declares the `assistantConsent` route role gets it; without the
role, Cavuno shows its own page. The role needs the page's marker,
`export const cavunoPage = 'assistantConsent'`: a page at the canonical
`/authorize` alone does not take it. Keep `/oauth/*` for the platform: a page
declared there is ignored.

The page passes its query string on unchanged, words the step in the board's
language from its facts (`access`, `trustLevel`, `publisherHost`,
`redirectHost`), and posts the person's choice from a server function. A
self-hosted site calls with its publishable key and also sends
`MCP_SITE_HEADER` with the same origin the handler sends: `siteOrigin` when
it is set, otherwise the request URL's origin. That origin is the sign-in's
issuer, so a different one fails the sign-in:

```ts snippet
import { createBoardClient } from '@cavuno/board';
import { MCP_SITE_HEADER } from '@cavuno/board/mcp';

const board = createBoardClient({ board: 'pk_live_abc' });
const auth = {
  headers: {
    authorization: 'Bearer <session access token>',
    // Self-hosted sites only: the handler's origin (its siteOrigin if set).
    [MCP_SITE_HEADER]: 'https://jobs.example.com',
  },
};

const step = await board.mcpConsent.get('?request=eyJ9', auth);
if (step.next === 'consent') {
  const decision = await board.mcpConsent.submit(
    {
      request: step.request,
      consentToken: step.consentToken,
      decision: 'allow',
    },
    auth);
}
```

`sign_in` and `verify_email` steps carry a `returnTo` back to the page;
`redirect` sends the browser to the assistant; `error` carries a `code` to
word the message from. Never cache either response.

## Completion gate

Finish only after every check passes against the deployed board:

- `POST /mcp` with `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
  `Content-Type: application/json` and
  `Accept: application/json, text/event-stream` returns the tool list.
- Opening `/mcp` in a browser lands on `/mcp/docs`, and that page names the
  board and shows `https://<board-host>/mcp` as the server URL.
- `GET /.well-known/ai-catalog.json` returns an entry whose `url` is
  `https://<board-host>/mcp/server-card`, and that card's `remotes` URL is
  `https://<board-host>/mcp`.
- A job URL in a `search_jobs` result opens on the board's own host.
- With `consentPath`: `GET /.well-known/oauth-protected-resource/mcp` returns
  a document whose `resource` is `https://<board-host>/mcp`, and
  `GET /oauth/authorize?state=x` redirects to `consentPath?state=x`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
