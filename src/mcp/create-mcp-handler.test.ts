import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMcpHandler } from './index';

interface Forwarded {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

function stubUpstream(answer: () => Response | Promise<Response>) {
  const calls: Forwarded[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: init?.body ? await new Response(init.body).text() : '',
      });
      return answer();
    }),
  );
  return calls;
}

const handler = createMcpHandler({ board: 'pk_live_abc' });
const rpc = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

function post(headers: Record<string, string> = {}): Request {
  return new Request('https://jobs.example.com/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
      ...headers,
    },
    body: rpc,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createMcpHandler', () => {
  it('forwards POST /mcp to the board endpoint with only the transport headers', async () => {
    const calls = stubUpstream(() =>
      Response.json(
        { jsonrpc: '2.0', id: 1, result: { tools: [] } },
        { headers: { 'set-cookie': 'leak=1' } },
      ),
    );
    const response = await handler(
      post({ cookie: 'session=1', authorization: 'Bearer secret' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      'https://api.cavuno.com/v1/boards/pk_live_abc/mcp',
    );
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toBe(rpc);
    expect(Object.fromEntries(calls[0]!.headers)).toEqual({
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-06-18',
    });
  });

  it('serves /mcp/docs from the setup page endpoint on a custom API origin', async () => {
    const calls = stubUpstream(
      () =>
        new Response('<!doctype html>', {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    );
    const custom = createMcpHandler({
      board: 'pk_live_abc',
      baseUrl: 'https://api.example.test/',
    });
    const response = await custom(
      new Request('https://jobs.example.com/mcp/docs'),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<!doctype html>');
    expect(calls[0]!.url).toBe(
      'https://api.example.test/v1/boards/pk_live_abc/mcp/docs',
    );
    expect(calls[0]!.method).toBe('GET');
  });

  it.each([
    [
      '/mcp/server-card',
      'https://api.cavuno.com/v1/boards/pk_live_abc/mcp/server-card',
      'application/mcp-server-card+json',
    ],
    [
      '/.well-known/ard.json',
      'https://api.cavuno.com/v1/boards/pk_live_abc/mcp/ai-catalog',
      'application/ai-catalog+json',
    ],
    [
      '/.well-known/ai-catalog.json',
      'https://api.cavuno.com/v1/boards/pk_live_abc/mcp/ai-catalog',
      'application/ai-catalog+json',
    ],
  ])(
    'forwards GET and HEAD %s to its discovery endpoint',
    async (path, upstream, mediaType) => {
      const calls = stubUpstream(
        () =>
          new Response('{"specVersion":"1.0"}', {
            headers: {
              'content-type': mediaType,
              'access-control-allow-origin': '*',
            },
          }),
      );
      const response = await handler(
        new Request(`https://jobs.example.com${path}`, {
          headers: { accept: mediaType, cookie: 'session=1' },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(mediaType);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(await response.text()).toBe('{"specVersion":"1.0"}');
      expect(calls[0]!.url).toBe(upstream);
      expect(calls[0]!.method).toBe('GET');
      expect(Object.fromEntries(calls[0]!.headers)).toEqual({
        accept: mediaType,
      });

      await handler(
        new Request(`https://jobs.example.com${path}`, {
          method: 'HEAD',
        }),
      );
      expect(calls[1]!.url).toBe(upstream);
      expect(calls[1]!.method).toBe('HEAD');
    },
  );

  it('passes a 404 for the AI Catalog of a board without the server through', async () => {
    stubUpstream(() =>
      Response.json(
        { error: { code: 'board_mcp_not_found' } },
        { status: 404 },
      ),
    );
    const response = await handler(
      new Request('https://jobs.example.com/.well-known/ai-catalog.json'),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'board_mcp_not_found' },
    });
  });

  it('sends a browser opening /mcp to the setup page without calling the API', async () => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await handler(
      new Request('https://jobs.example.com/mcp', {
        headers: { accept: 'text/html,application/xhtml+xml' },
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/mcp/docs');
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['GET', '/mcp', 'POST'],
    ['DELETE', '/mcp', 'POST'],
    ['POST', '/mcp/docs', 'GET, HEAD'],
    ['POST', '/mcp/server-card', 'GET, HEAD'],
    ['DELETE', '/.well-known/ai-catalog.json', 'GET, HEAD'],
  ])('answers %s %s with 405', async (method, path, allow) => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await handler(
      new Request(`https://jobs.example.com${path}`, {
        method,
        headers: { accept: 'application/json' },
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(allow);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['POST', 'application/json, text/event-stream'],
    ['GET', 'text/html'],
    ['GET', 'application/json'],
  ])(
    'answers %s to an unknown path below /mcp with 404 (%s)',
    async (method, accept) => {
      const calls = stubUpstream(() => Response.json({}));
      const response = await handler(
        new Request('https://jobs.example.com/mcp/anything', {
          method,
          headers: { accept, 'content-type': 'application/json' },
          body: method === 'POST' ? rpc : undefined,
        }),
      );

      expect(response.status).toBe(404);
      expect(calls).toHaveLength(0);
    },
  );

  it('refuses a body over 64 KB without reading or forwarding it', async () => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await handler(
      post({ 'content-length': String(64 * 1024 + 1) }),
    );

    expect(response.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it('stops reading a streamed body without content-length at 64 KB', async () => {
    const calls = stubUpstream(() => Response.json({}));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(16 * 1024));
        if (pulled === 100) controller.close();
      },
    });
    const response = await handler(
      new Request('https://jobs.example.com/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    );

    expect(response.status).toBe(413);
    expect(calls).toHaveLength(0);
    expect(pulled).toBeLessThan(10);
  });

  it('strips the encoding headers the runtime has already decoded', async () => {
    stubUpstream(
      () =>
        new Response('<!doctype html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-encoding': 'gzip',
            'content-length': '15',
          },
        }),
    );
    const response = await handler(
      new Request('https://jobs.example.com/mcp/docs'),
    );

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toBe('<!doctype html>');
  });

  it('passes the API status through, including a board without the server', async () => {
    stubUpstream(() =>
      Response.json(
        { error: { code: 'board_mcp_not_found' } },
        { status: 404 },
      ),
    );
    const response = await handler(post());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'board_mcp_not_found' },
    });
  });

  it('answers a JSON-RPC 503 when the API is unreachable', async () => {
    stubUpstream(() => {
      throw new TypeError('fetch failed');
    });
    const response = await handler(post());

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32000 },
    });
  });
});

describe('createMcpHandler without consentPath', () => {
  it.each([
    ['GET', '/.well-known/oauth-protected-resource'],
    ['GET', '/.well-known/oauth-protected-resource/mcp'],
    ['GET', '/.well-known/oauth-authorization-server'],
    ['GET', '/.well-known/oauth-protected-resource/jobboard/mcp'],
    ['GET', '/.well-known/oauth-authorization-server/jobboard'],
    ['GET', '/.well-known/poppy.json'],
    ['HEAD', '/.well-known/poppy.json'],
    ['OPTIONS', '/.well-known/poppy.json'],
    ['POST', '/oauth/register'],
    ['POST', '/oauth/token'],
    ['POST', '/oauth/revoke'],
    ['GET', '/oauth/authorize'],
    ['OPTIONS', '/oauth/token'],
  ])('answers %s %s with 404 without calling the API', async (method, path) => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await handler(
      new Request(`https://jobs.example.com${path}`, {
        method,
        body: method === 'POST' ? 'grant_type=refresh_token' : undefined,
      }),
    );

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('names no site on any forward', async () => {
    const calls = stubUpstream(() => Response.json({}));
    await handler(post({ authorization: 'Bearer token' }));
    await handler(new Request('https://jobs.example.com/mcp/docs'));

    for (const call of calls) {
      expect(call.headers.get('x-cavuno-mcp-site')).toBeNull();
      expect(call.headers.get('authorization')).toBeNull();
    }
  });
});

describe('createMcpHandler with consentPath', () => {
  const signIn = createMcpHandler({
    board: 'pk_live_abc',
    consentPath: '/autoriser',
  });
  const API = 'https://api.cavuno.com/v1/boards/pk_live_abc';

  it('forwards POST /mcp with the visitor’s authorization, names the site, and passes the sign-in challenge through', async () => {
    const challenge =
      'Bearer resource_metadata="https://jobs.example.com/.well-known/oauth-protected-resource/mcp", scope="candidate"';
    const calls = stubUpstream(() =>
      Response.json(
        { jsonrpc: '2.0', id: 1, error: { code: -32001 } },
        {
          status: 401,
          headers: { 'www-authenticate': challenge, 'set-cookie': 'leak=1' },
        },
      ),
    );
    const response = await signIn(
      post({ cookie: 'session=1', authorization: 'Bearer token' }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(challenge);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(calls[0]!.url).toBe(`${API}/mcp`);
    expect(Object.fromEntries(calls[0]!.headers)).toEqual({
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer token',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-06-18',
      'x-cavuno-mcp-site': 'https://jobs.example.com',
    });
  });

  it('names the site on the setup page forward, so it lists the signed-in tools', async () => {
    const calls = stubUpstream(() => new Response('<!doctype html>'));
    await signIn(new Request('http://localhost:5173/mcp/docs'));

    expect(calls[0]!.url).toBe(`${API}/mcp/docs`);
    expect(calls[0]!.headers.get('x-cavuno-mcp-site')).toBe(
      'http://localhost:5173',
    );
  });

  it.each([
    [
      '/.well-known/oauth-protected-resource',
      `${API}/mcp/oauth/.well-known/oauth-protected-resource`,
    ],
    [
      '/.well-known/oauth-protected-resource/mcp',
      `${API}/mcp/oauth/.well-known/oauth-protected-resource/mcp`,
    ],
    [
      '/.well-known/oauth-authorization-server',
      `${API}/mcp/oauth/.well-known/oauth-authorization-server`,
    ],
    [
      '/.well-known/oauth-protected-resource/jobboard/mcp',
      `${API}/mcp/oauth/.well-known/oauth-protected-resource/mcp`,
    ],
    [
      '/.well-known/oauth-authorization-server/jobboard',
      `${API}/mcp/oauth/.well-known/oauth-authorization-server`,
    ],
    ['/.well-known/poppy.json', `${API}/mcp/oauth/.well-known/poppy.json`],
  ])('forwards GET and HEAD %s', async (path, upstream) => {
    const calls = stubUpstream(() =>
      Response.json(
        { issuer: 'https://jobs.example.com' },
        { headers: { 'access-control-allow-origin': '*' } },
      ),
    );
    const response = await signIn(
      new Request(`https://jobs.example.com${path}`, {
        headers: { accept: 'application/json', cookie: 'session=1' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(calls[0]!.url).toBe(upstream);
    expect(calls[0]!.method).toBe('GET');
    expect(Object.fromEntries(calls[0]!.headers)).toEqual({
      accept: 'application/json',
      'x-cavuno-mcp-site': 'https://jobs.example.com',
    });

    await signIn(
      new Request(`https://jobs.example.com${path}`, { method: 'HEAD' }),
    );
    expect(calls[1]!.url).toBe(upstream);
    expect(calls[1]!.method).toBe('HEAD');
  });

  it.each([
    ['/oauth/register', `${API}/mcp/oauth/register`, 'application/json'],
    [
      '/oauth/token',
      `${API}/mcp/oauth/token`,
      'application/x-www-form-urlencoded',
    ],
    [
      '/oauth/revoke',
      `${API}/mcp/oauth/revoke`,
      'application/x-www-form-urlencoded',
    ],
    [
      '/jobboard/oauth/token',
      `${API}/mcp/oauth/token`,
      'application/x-www-form-urlencoded',
    ],
  ])(
    'forwards POST %s with its body and client credentials',
    async (path, upstream, contentType) => {
      const calls = stubUpstream(() =>
        Response.json(
          { access_token: 'a' },
          { headers: { 'set-cookie': 'leak=1' } },
        ),
      );
      const body =
        contentType === 'application/json'
          ? '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}'
          : 'grant_type=refresh_token&refresh_token=brt_1';
      const response = await signIn(
        new Request(`https://jobs.example.com${path}`, {
          method: 'POST',
          headers: {
            'content-type': contentType,
            accept: 'application/json',
            'user-agent': 'Claude-User',
            authorization: 'Basic Y2xpZW50OnNlY3JldA==',
            cookie: 'session=1',
          },
          body,
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(calls[0]!.url).toBe(upstream);
      expect(calls[0]!.method).toBe('POST');
      expect(calls[0]!.body).toBe(body);
      expect(Object.fromEntries(calls[0]!.headers)).toEqual({
        accept: 'application/json',
        authorization: 'Basic Y2xpZW50OnNlY3JldA==',
        'content-type': contentType,
        'user-agent': 'Claude-User',
        'x-cavuno-mcp-site': 'https://jobs.example.com',
      });
    },
  );

  it('sends /oauth/authorize to the consent page with the query byte for byte, without calling the API', async () => {
    const calls = stubUpstream(() => Response.json({}));
    const query =
      '?response_type=code&client_id=https%3A%2F%2Fclaude.ai%2Foauth&state=1e3&scope=candidate%20employer&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback';
    const response = await signIn(
      new Request(`https://jobs.example.com/oauth/authorize${query}`),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`/autoriser${query}`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(calls).toHaveLength(0);

    const bare = await signIn(
      new Request('https://jobs.example.com/oauth/authorize'),
    );
    expect(bare.headers.get('location')).toBe('/autoriser');
  });

  it('answers the browser preflight for the sign-in endpoints without calling the API', async () => {
    const calls = stubUpstream(() => Response.json({}));
    for (const path of [
      '/oauth/token',
      '/.well-known/oauth-authorization-server',
      '/.well-known/poppy.json',
    ]) {
      const response = await signIn(
        new Request(`https://jobs.example.com${path}`, { method: 'OPTIONS' }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-headers')).toContain(
        'authorization',
      );
    }
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['GET', '/oauth/token', 'POST'],
    ['POST', '/.well-known/oauth-authorization-server', 'GET, HEAD'],
    ['POST', '/.well-known/poppy.json', 'GET, HEAD'],
    ['POST', '/oauth/authorize', 'GET, HEAD'],
  ])('answers %s %s with 405', async (method, path, allow) => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await signIn(
      new Request(`https://jobs.example.com${path}`, {
        method,
        body: method === 'POST' ? 'x=1' : undefined,
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(allow);
    expect(calls).toHaveLength(0);
  });

  it('refuses an OAuth body over 64 KB with an OAuth error, without forwarding it', async () => {
    const calls = stubUpstream(() => Response.json({}));
    const response = await signIn(
      new Request('https://jobs.example.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${'a'.repeat(64 * 1024)}`,
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: 'invalid_request' });
    expect(calls).toHaveLength(0);
  });

  it('names the configured site origin behind a proxy that rewrites the host', async () => {
    const calls = stubUpstream(() => Response.json({}));
    const proxied = createMcpHandler({
      board: 'pk_live_abc',
      consentPath: '/authorize',
      siteOrigin: 'https://jobs.example.com/',
    });
    await proxied(
      new Request('http://127.0.0.1:8080/oauth/token', {
        method: 'POST',
        body: 'grant_type=refresh_token',
      }),
    );

    expect(calls[0]!.headers.get('x-cavuno-mcp-site')).toBe(
      'https://jobs.example.com',
    );
  });

  it.each([
    'authorize',
    '//evil.example/authorize',
    '/authorize?x=1',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/autho\u0000rize',
  ])('refuses consentPath %j', (consentPath) => {
    expect(() =>
      createMcpHandler({ board: 'pk_live_abc', consentPath }),
    ).toThrow(TypeError);
  });

  it.each(['/authorize', '/fr/autoriser', '/a%2Fb'])(
    'accepts consentPath %s',
    (consentPath) => {
      expect(() =>
        createMcpHandler({ board: 'pk_live_abc', consentPath }),
      ).not.toThrow();
    },
  );

  it.each(['acme-jobs', 'boards_abc123'])(
    'refuses sign-in for board %s, which is not a publishable key',
    (board) => {
      expect(() =>
        createMcpHandler({ board, consentPath: '/authorize' }),
      ).toThrow(/publishable key/);
      // Anonymous serving takes any identifier, as before.
      expect(() => createMcpHandler({ board })).not.toThrow();
    },
  );
});
