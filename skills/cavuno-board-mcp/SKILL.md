---
name: cavuno-board-mcp
description: Serve the board's public MCP server at /mcp with @cavuno/board/mcp. Use when connecting a self-hosted board to Claude, ChatGPT, Cursor or another MCP client, or when /mcp or /mcp/docs returns 404 on the board's host.
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
of `/mcp`: every tool is an anonymous read, and MCP clients POST without
credentials.

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

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
