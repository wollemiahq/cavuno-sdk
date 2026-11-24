/**
 * The board's public MCP server on a self-hosted board's own host.
 *
 * Mount the handler at `/mcp`, `/mcp/*`, `/.well-known/ard.json` and
 * `/.well-known/ai-catalog.json`.
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
 * - `GET|HEAD /.well-known/ard.json` is the Agentic Resource Discovery (ARD)
 *   manifest listing that card, so an assistant can find the server from the
 *   board's domain alone. `/.well-known/ai-catalog.json`, the path of its
 *   predecessor, the AI Catalog, answers the same manifest.
 *
 * By default every tool is an anonymous read: only the MCP transport headers
 * are forwarded, no cookies and no authorization.
 *
 * With `consentPath`, people can also sign in to their own account on the
 * board from their assistant (OAuth 2.1), on this site's own domain. Mount
 * the handler at `/.well-known/oauth-protected-resource`,
 * `/.well-known/oauth-protected-resource/mcp`,
 * `/.well-known/oauth-authorization-server`, `/.well-known/poppy.json` and
 * `/oauth/*` too:
 *
 * - The discovery documents and `POST /oauth/register`, `/oauth/token` and
 *   `/oauth/revoke` are forwarded to `/v1/boards/{board}/mcp/oauth/*`.
 * - `/.well-known/poppy.json` is the Personal Agent Protocol discovery
 *   document, so personal agents can find the board and sign people in.
 *   The Board API answers it while the board takes personal agents, and
 *   404 otherwise. It stays at the domain root under a `basePath`.
 * - A site served under a path, such as `/jobboard`, mounts the handler at
 *   `/jobboard/mcp` and `/jobboard/oauth/*`, and its discovery documents at
 *   `/.well-known/oauth-protected-resource/jobboard/mcp` and
 *   `/.well-known/oauth-authorization-server/jobboard`. The Board API reads
 *   the path from the board's route manifest (`basePath`), so the site must
 *   publish one.
 * - `GET /oauth/authorize` sends the browser to `consentPath` with the
 *   assistant's query unchanged; the site's own consent page shows the step
 *   from `board.mcpConsent.get` and answers it with `board.mcpConsent.submit`.
 * - `POST /mcp` also forwards `authorization`, and every forward names this
 *   site in `x-cavuno-mcp-site` (`MCP_SITE_HEADER`). The Board API signs
 *   people in only when that is the publishable key's registered origin or
 *   one of the board's development origins.
 *
 * The Board API's per-visitor limit sees this server's address, so it applies
 * to all of the board's MCP traffic together.
 *
 * Framework-portable: standard Request in, standard Response out.
 */

import { DEFAULT_CAVUNO_API_URL } from '../constants';

/**
 * The request header naming the self-hosted site a Board API call comes
 * through, e.g. `https://jobs.example.com`. The handler sends it on every
 * forward when sign-in is on; a consent page's server sends it with
 * `board.mcpConsent.get` and `submit`.
 */
export const MCP_SITE_HEADER = 'x-cavuno-mcp-site';

export interface CreateMcpHandlerConfig {
  /**
   * The board's publishable key (`pk_…`), required for sign-in
   * (`consentPath`). Job and company links in tool results then point at the
   * key's own origin, this board.
   */
  board: string;
  /** Board API origin. Defaults to `https://api.cavuno.com`. */
  baseUrl?: string;
  /**
   * The path of this site's consent page, e.g. `/authorize`: where
   * `/oauth/authorize` sends the browser. Setting it turns on sign-in from
   * assistants; without it the server stays anonymous. A path on this site,
   * without a query.
   */
  consentPath?: string;
  /**
   * The origin this site is served on, e.g. `https://jobs.example.com`, when
   * the request URL the handler sees is not it (a proxy that rewrites the
   * host or the scheme). Defaults to the request URL's origin, which also
   * serves a registered development origin such as `http://localhost:5173`.
   * Only used with `consentPath`.
   */
  siteOrigin?: string;
}

/**
 * GET-only documents, by the end of the request path, and the Board API
 * path below `/v1/boards/{board}/` that answers each.
 */
const DOCUMENT_UPSTREAMS = [
  ['/mcp/docs', 'mcp/docs'],
  ['/mcp/server-card', 'mcp/server-card'],
  ['/.well-known/ard.json', 'mcp/ai-catalog'],
  ['/.well-known/ai-catalog.json', 'mcp/ai-catalog'],
] as const;

/**
 * Sign-in paths, by the end of the request path, the method they answer and
 * the Board API path below `/v1/boards/{board}/` that answers each. Matched
 * before the transport: `/.well-known/oauth-protected-resource/mcp` ends
 * with `/mcp` too.
 */
const OAUTH_UPSTREAMS = [
  [
    '/.well-known/oauth-protected-resource/mcp',
    'GET',
    'mcp/oauth/.well-known/oauth-protected-resource/mcp',
  ],
  [
    '/.well-known/oauth-protected-resource',
    'GET',
    'mcp/oauth/.well-known/oauth-protected-resource',
  ],
  [
    '/.well-known/oauth-authorization-server',
    'GET',
    'mcp/oauth/.well-known/oauth-authorization-server',
  ],
  ['/.well-known/poppy.json', 'GET', 'mcp/oauth/.well-known/poppy.json'],
  ['/oauth/register', 'POST', 'mcp/oauth/register'],
  ['/oauth/token', 'POST', 'mcp/oauth/token'],
  ['/oauth/revoke', 'POST', 'mcp/oauth/revoke'],
] as const;

const AUTHORIZE_PATH = '/oauth/authorize';

/**
 * Under a `basePath` the discovery documents stay at the domain root, with
 * the base after the well-known name (RFC 9728 §3.1, RFC 8414 §3.1):
 * `/.well-known/oauth-protected-resource/jobboard/mcp` and
 * `/.well-known/oauth-authorization-server/jobboard`. The Board API answers
 * both for the base the board's route manifest declares, so each is
 * forwarded like its root document; the base in the path is not passed on.
 */
const BASE_PATH_DISCOVERY = [
  [
    /\/\.well-known\/oauth-protected-resource\/.+\/mcp$/,
    '/.well-known/oauth-protected-resource/mcp',
  ],
  [
    /\/\.well-known\/oauth-authorization-server\/.+$/,
    '/.well-known/oauth-authorization-server',
  ],
] as const;

/** The root document a base-path discovery path stands for, else the path. */
function discoveryPath(path: string): string {
  const match = BASE_PATH_DISCOVERY.find(([pattern]) => pattern.test(path));
  return match ? match[1] : path;
}

/**
 * The preflight the Board API answers for these endpoints, answered here:
 * browser MCP clients call them cross-origin, and the answer is the same
 * for every board.
 */
const OAUTH_PREFLIGHT_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, content-type, mcp-protocol-version',
};

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

const OAUTH_FORWARDED_HEADERS = [
  'content-type',
  'accept',
  'user-agent',
  // A confidential client's `client_secret_basic`.
  'authorization',
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

/** An OAuth error body (RFC 6749 §5.2), for the sign-in endpoints. */
function oauthError(
  status: number,
  error: string,
  description: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...OAUTH_PREFLIGHT_HEADERS,
        ...headers,
      },
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
 * A path on this site: browsers drop tabs and newlines and read `\` as `/`,
 * so `/\evil.example` or `/<tab>/evil.example` would leave it.
 */
function checkConsentPath(path: string): string {
  const base = 'https://site.invalid';
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[?#\\\u0000-\u001f\u007f]/.test(path) ||
    new URL(path, base).origin !== base
  ) {
    throw new TypeError(
      'consentPath must be a path on this site, such as /authorize, without a query.',
    );
  }
  return path;
}

/**
 * Create the `(request) => Response` handler for `/mcp`, `/mcp/docs`,
 * `/mcp/server-card`, `/.well-known/ard.json` and
 * `/.well-known/ai-catalog.json`, and with
 * `consentPath` the sign-in paths `/.well-known/oauth-protected-resource`,
 * `/.well-known/oauth-protected-resource/mcp`,
 * `/.well-known/oauth-authorization-server`, `/.well-known/poppy.json` and
 * `/oauth/*`. A site under a
 * `basePath` such as `/jobboard` mounts `/jobboard/mcp` and
 * `/jobboard/oauth/*`, and at the domain root
 * `/.well-known/oauth-protected-resource/jobboard/mcp` and
 * `/.well-known/oauth-authorization-server/jobboard`. Its route manifest
 * (`/.well-known/cavuno.json`) declares `basePath: '/jobboard'`, and its
 * `consentPath` includes the base, such as `/jobboard/authorize`.
 *
 * @example
 * // Next.js App Router: one handler module, lib/mcp.ts:
 * import { createMcpHandler } from '@cavuno/board/mcp';
 *
 * export const handler = createMcpHandler({
 *   board: process.env.NEXT_PUBLIC_CAVUNO_BOARD_KEY!,
 *   consentPath: '/authorize',
 * });
 *
 * // app/mcp/[[...path]]/route.ts, app/.well-known/ard.json/route.ts and
 * // app/.well-known/ai-catalog.json/route.ts:
 * export { handler as GET, handler as HEAD, handler as POST } from '@/lib/mcp';
 *
 * // With sign-in, also app/.well-known/oauth-protected-resource/[[...path]]/route.ts,
 * // app/.well-known/oauth-authorization-server/[[...path]]/route.ts,
 * // app/.well-known/poppy.json/route.ts and app/oauth/[...path]/route.ts,
 * // which answer browser preflights too:
 * export {
 *   handler as GET,
 *   handler as HEAD,
 *   handler as POST,
 *   handler as OPTIONS,
 * } from '@/lib/mcp';
 */
export function createMcpHandler(config: CreateMcpHandlerConfig) {
  const base = `${(config.baseUrl ?? DEFAULT_CAVUNO_API_URL).replace(/\/+$/, '')}/v1/boards/${encodeURIComponent(config.board)}`;
  const consentPath =
    config.consentPath === undefined
      ? null
      : checkConsentPath(config.consentPath);
  if (consentPath !== null && !config.board.startsWith('pk_')) {
    // The Board API signs people in only through a key's registered origins.
    throw new TypeError(
      "Sign-in from assistants (consentPath) needs the board's publishable key (pk_…) as board.",
    );
  }
  const fixedSiteOrigin =
    config.siteOrigin === undefined ? null : new URL(config.siteOrigin).origin;

  return async function mcpHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method;
    const signIn = consentPath !== null;
    let upstream: string;
    let forwarded: readonly string[] = FORWARDED_HEADERS;
    let oauth = false;

    const oauthPath = discoveryPath(path);
    const oauthRoute = OAUTH_UPSTREAMS.find(([suffix]) =>
      oauthPath.endsWith(suffix),
    );
    const document = DOCUMENT_UPSTREAMS.find(([suffix]) =>
      path.endsWith(suffix),
    );
    if (oauthRoute || path.endsWith(AUTHORIZE_PATH)) {
      if (!signIn) return new Response(null, { status: 404 });
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: OAUTH_PREFLIGHT_HEADERS,
        });
      }
      if (!oauthRoute) {
        if (method !== 'GET' && method !== 'HEAD') {
          return new Response(null, {
            status: 405,
            headers: { allow: 'GET, HEAD' },
          });
        }
        // The consent page reads the assistant's OAuth parameters itself.
        return new Response(null, {
          status: 302,
          headers: {
            location: `${consentPath}${url.search}`,
            'cache-control': 'no-store',
          },
        });
      }
      const [, allowed, upstreamPath] = oauthRoute;
      const ok =
        allowed === 'GET'
          ? method === 'GET' || method === 'HEAD'
          : method === 'POST';
      if (!ok) {
        return new Response(null, {
          status: 405,
          headers: { allow: allowed === 'GET' ? 'GET, HEAD' : 'POST' },
        });
      }
      upstream = `${base}/${upstreamPath}`;
      forwarded = OAUTH_FORWARDED_HEADERS;
      oauth = true;
    } else if (document) {
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
      // The signed-in person's access token, for the board to check.
      if (signIn) forwarded = [...FORWARDED_HEADERS, 'authorization'];
    }

    let body: Uint8Array<ArrayBuffer> | undefined;
    if (method === 'POST') {
      const read = await readCappedBody(request);
      if (!read) {
        return oauth
          ? oauthError(413, 'invalid_request', 'Request body too large.')
          : jsonRpcError(413, 'Request body too large.');
      }
      body = read;
    }

    const headers = new Headers();
    for (const name of forwarded) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (signIn) headers.set(MCP_SITE_HEADER, fixedSiteOrigin ?? url.origin);

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
      return oauth
        ? oauthError(
            503,
            'temporarily_unavailable',
            'The board sign-in server is unavailable.',
            { 'retry-after': '30' },
          )
        : jsonRpcError(503, 'The board MCP server is unavailable.', {
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
