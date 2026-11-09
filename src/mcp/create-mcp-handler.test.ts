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
