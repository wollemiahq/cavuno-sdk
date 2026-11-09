/**
 * The board's public MCP server on a self-hosted board's own host.
 *
 * Mount the handler at `/mcp`, `/mcp/*` and `/.well-known/ai-catalog.json`.
 * It forwards to the Board API's `POST /v1/boards/{board}/mcp` and its
 * `GET /v1/boards/{board}/mcp/docs`, `/mcp/server-card` and `/mcp/ai-catalog`,
 * the same endpoints Cavuno-hosted boards answer from, so the tools, limits,
 * setup page and discovery documents stay identical everywhere:
 *
 * - `POST /mcp` is the stateless Streamable HTTP transport.
 * - A browser opening `/mcp` is sent to `/mcp/docs`; any other method is 405.
 * - `GET|HEAD /mcp/docs` is the HTML setup page listed in AI directories.
 * - `GET|HEAD /mcp/server-card` is the MCP Server Card: the server's name,
 *   version and URL, for an assistant to read before it connects.
 * - `GET|HEAD /.well-known/ai-catalog.json` is the AI Catalog listing that
 *   card, so an assistant can find the server from the board's domain alone.
 *
 * Only the MCP transport headers are forwarded: no cookies and no
 * authorization, because every tool is an anonymous read. The Board API's
 * per-visitor limit sees this server's address, so it applies to all of the
 * board's MCP traffic together.
 *
 * Framework-portable: standard Request in, standard Response out.
 */

import { DEFAULT_CAVUNO_API_URL } from '../constants';

export interface CreateMcpHandlerConfig {
  /**
   * The board's publishable key (`pk_…`). Job and company links in tool
   * results then point at the key's own origin, this board.
   */
  board: string;
  /** Board API origin. Defaults to `https://api.cavuno.com`. */
  baseUrl?: string;
}

/**
 * GET-only documents, by the end of the request path, and the Board API
 * path below `/v1/boards/{board}/` that answers each.
 */
const DOCUMENT_UPSTREAMS = [
  ['/mcp/docs', 'mcp/docs'],
  ['/mcp/server-card', 'mcp/server-card'],
  ['/.well-known/ai-catalog.json', 'mcp/ai-catalog'],
] as const;

/** The Board API refuses MCP request bodies above this size. */
const MAX_BODY_BYTES = 64 * 1024;
/** Bounds the whole exchange with the Board API, streamed response included. */
const UPSTREAM_TIMEOUT_MS = 30_000;

const FORWARDED_HEADERS = [
  'content-type',
  'accept',
  'mcp-protocol-version',
  'user-agent',
] as const;

function jsonRpcError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message },
    }),
    {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    },
  );
}

/**
 * The request body, or null once it passes `MAX_BODY_BYTES`. Read in chunks
 * so a body sent without `content-length` stops being buffered at the limit.
 */
async function readCappedBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    return null;
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Create the `(request) => Response` handler for `/mcp`, `/mcp/docs`,
 * `/mcp/server-card` and `/.well-known/ai-catalog.json`.
 *
 * @example
 * // Next.js App Router: app/mcp/[[...path]]/route.ts and
 * // app/.well-known/ai-catalog.json/route.ts, both exporting:
 * import { createMcpHandler } from '@cavuno/board/mcp';
 *
 * const handler = createMcpHandler({
 *   board: process.env.NEXT_PUBLIC_CAVUNO_BOARD_KEY!,
 * });
 * export const GET = handler;
 * export const HEAD = handler;
 * export const POST = handler;
 */
export function createMcpHandler(config: CreateMcpHandlerConfig) {
  const base = `${(config.baseUrl ?? DEFAULT_CAVUNO_API_URL).replace(/\/+$/, '')}/v1/boards/${encodeURIComponent(config.board)}`;

  return async function mcpHandler(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const path = pathname.replace(/\/+$/, '');
    const method = request.method;
    let upstream: string;

    const document = DOCUMENT_UPSTREAMS.find(([suffix]) =>
      path.endsWith(suffix),
    );
    if (document) {
      if (method !== 'GET' && method !== 'HEAD') {
        return new Response(null, {
          status: 405,
          headers: { allow: 'GET, HEAD' },
        });
      }
      upstream = `${base}/${document[1]}`;
    } else if (!path.endsWith('/mcp')) {
      // A catch-all mount sees every path below `/mcp`; only the endpoint itself is MCP.
      return new Response(null, { status: 404 });
    } else {
      const accept = request.headers.get('accept') ?? '';
      if (
        method === 'GET' &&
        accept.includes('text/html') &&
        !accept.includes('text/event-stream')
      ) {
        return new Response(null, {
          status: 302,
          headers: { location: `${path}/docs`, 'cache-control': 'no-store' },
        });
      }
      if (method !== 'POST') {
        return jsonRpcError(405, 'Method not allowed.', { allow: 'POST' });
      }
      upstream = `${base}/mcp`;
    }

    let body: Uint8Array<ArrayBuffer> | undefined;
    if (method === 'POST') {
      const read = await readCappedBody(request);
      if (!read) return jsonRpcError(413, 'Request body too large.');
      body = read;
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    let response: Response;
    try {
      response = await fetch(upstream, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      return jsonRpcError(503, 'The board MCP server is unavailable.', {
        'retry-after': '30',
      });
    }

    const outHeaders = new Headers(response.headers);
    outHeaders.delete('set-cookie');
    // The runtime has already decoded the body.
    outHeaders.delete('content-encoding');
    outHeaders.delete('content-length');
    return new Response(response.body, {
      status: response.status,
      headers: outHeaders,
    });
  };
}
