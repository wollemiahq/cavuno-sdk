import { afterEach, describe, expect, it, vi } from 'vitest';

import { BoardClient, redactUrlForLog, type BoardRequest } from './client';
import { BoardApiError, isUnauthorized } from './errors';
import { ACCESS_TOKEN_KEY, resolveStorage } from './storage';
import { SDK_VERSION } from './version';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(
  overrides: Partial<ConstructorParameters<typeof BoardClient>[0]> = {},
) {
  return new BoardClient({
    baseUrl: 'https://api.cavuno.com',
    board: 'acme-jobs',
    storage: resolveStorage('nostore'),
    ...overrides,
  });
}

function stubFetch(response: Response | (() => Response) = jsonResponse({})) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    typeof response === 'function' ? response() : response.clone(),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

type FetchSpy = ReturnType<typeof stubFetch>;

function sentInit(spy: FetchSpy, call = 0) {
  return spy.mock.calls[call]![1] as RequestInit;
}

function sentHeaders(spy: FetchSpy, call = 0) {
  return sentInit(spy, call).headers as Headers;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL construction', () => {
  it('prefixes every path with /v1/boards/<identifier>', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs');
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs',
    );
  });

  it('normalizes a trailing slash on baseUrl', async () => {
    const spy = stubFetch();
    await makeClient({ baseUrl: 'https://api.cavuno.com/' }).fetch('/jobs');
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs',
    );
  });

  it('URL-encodes the board identifier', async () => {
    const spy = stubFetch();
    await makeClient({ board: 'pk_a8f3/odd' }).fetch('/jobs');
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/pk_a8f3%2Fodd/jobs',
    );
  });

  it('empty path hits the bare board root with no trailing slash', async () => {
    const spy = stubFetch();
    await makeClient().fetch('');
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs',
    );
  });

  it('appends serialized query to the URL', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs', {
      query: { limit: 10, companyId: ['a', 'b'], cursor: undefined },
    });
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs?limit=10&companyId=a&companyId=b',
    );
  });
});

describe('headers', () => {
  it('sends Accept: application/json on every request', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs');
    expect(sentHeaders(spy).get('accept')).toBe('application/json');
  });

  it('merges globalHeaders over defaults and per-call headers over both', async () => {
    const spy = stubFetch();
    const client = makeClient({
      globalHeaders: { accept: 'application/vnd.global', 'x-team': 'g' },
    });
    await client.fetch('/jobs', { headers: { 'x-team': 'per-call' } });
    expect(sentHeaders(spy).get('accept')).toBe('application/vnd.global');
    expect(sentHeaders(spy).get('x-team')).toBe('per-call');
  });

  it('accepts Headers instances as per-call headers (no object spread)', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs', {
      headers: new Headers({ 'x-from-headers': 'yes' }),
    });
    expect(sentHeaders(spy).get('x-from-headers')).toBe('yes');
  });

  it('reads the bearer token from storage on every request', async () => {
    const storage = resolveStorage('memory');
    const spy = stubFetch();
    const client = makeClient({ storage });
    await client.fetch('/me');
    expect(sentHeaders(spy, 0).get('authorization')).toBeNull();

    await storage.setItem(ACCESS_TOKEN_KEY, 'jwt-1');
    await client.fetch('/me');
    expect(sentHeaders(spy, 1).get('authorization')).toBe('Bearer jwt-1');

    await storage.setItem(ACCESS_TOKEN_KEY, 'jwt-2');
    await client.fetch('/me');
    expect(sentHeaders(spy, 2).get('authorization')).toBe('Bearer jwt-2');
  });

  it('per-call Authorization wins over the storage token', async () => {
    const storage = resolveStorage('memory');
    await storage.setItem(ACCESS_TOKEN_KEY, 'stored');
    const spy = stubFetch();
    await makeClient({ storage }).fetch('/me', {
      headers: { authorization: 'Bearer per-call' },
    });
    expect(sentHeaders(spy).get('authorization')).toBe('Bearer per-call');
  });
});

describe('X-Cavuno-Sdk header (preflight-preserving rule)', () => {
  it('bare anonymous GET carries no X-Cavuno-Sdk header (stays CORS-simple)', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs');
    expect(sentHeaders(spy).get('x-cavuno-sdk')).toBeNull();
  });

  it('POST carries X-Cavuno-Sdk: board@<version>', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs/search', { method: 'POST', body: {} });
    expect(sentHeaders(spy).get('x-cavuno-sdk')).toBe(`board@${SDK_VERSION}`);
  });

  it('GET with a storage token carries X-Cavuno-Sdk', async () => {
    const storage = resolveStorage('memory');
    await storage.setItem(ACCESS_TOKEN_KEY, 'jwt');
    const spy = stubFetch();
    await makeClient({ storage }).fetch('/me');
    expect(sentHeaders(spy).get('x-cavuno-sdk')).toBe(`board@${SDK_VERSION}`);
  });

  it('GET with per-call authorization carries X-Cavuno-Sdk (SSR pattern)', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/me', {
      headers: { authorization: 'Bearer ssr' },
    });
    expect(sentHeaders(spy).get('x-cavuno-sdk')).toBe(`board@${SDK_VERSION}`);
  });

  it('an explicit X-Cavuno-Sdk header is not overwritten', async () => {
    const spy = stubFetch();
    await makeClient({
      globalHeaders: { 'X-Cavuno-Sdk': 'custom' },
    }).fetch('/jobs/search', { method: 'POST', body: {} });
    expect(sentHeaders(spy).get('x-cavuno-sdk')).toBe('custom');
  });
});

describe('body handling', () => {
  it('JSON-stringifies object bodies and sets Content-Type', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs/search', {
      method: 'POST',
      body: { query: 'chef' },
    });
    expect(sentInit(spy).body).toBe('{"query":"chef"}');
    expect(sentHeaders(spy).get('content-type')).toBe('application/json');
  });

  it('passes string bodies through untouched without a JSON Content-Type', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs/search', {
      method: 'POST',
      body: 'raw-payload',
    });
    expect(sentInit(spy).body).toBe('raw-payload');
    expect(sentHeaders(spy).get('content-type')).toBeNull();
  });
});

describe('RequestInit passthrough', () => {
  it('signal, cache, and unknown keys (next, cf) reach fetch in init', async () => {
    const spy = stubFetch();
    const controller = new AbortController();
    await makeClient().fetch('/jobs', {
      signal: controller.signal,
      cache: 'no-store',
      next: { tags: ['jobs'] },
      cf: { cacheTtl: 60 },
    } as never);
    const init = sentInit(spy) as RequestInit & {
      next?: unknown;
      cf?: unknown;
    };
    expect(init.signal).toBe(controller.signal);
    expect(init.cache).toBe('no-store');
    expect(init.next).toEqual({ tags: ['jobs'] });
    expect(init.cf).toEqual({ cacheTtl: 60 });
  });

  it('passthrough cannot clobber the computed method and body', async () => {
    const spy = stubFetch();
    await makeClient().fetch('/jobs/search', {
      method: 'POST',
      body: { a: 1 },
    });
    expect(sentInit(spy).method).toBe('POST');
    expect(sentInit(spy).body).toBe('{"a":1}');
  });
});

describe('hooks', () => {
  it('onRequest receives the final BoardRequest and its return value is fetched', async () => {
    const spy = stubFetch();
    const seen: BoardRequest[] = [];
    const client = makeClient({
      onRequest: (req) => {
        seen.push(req);
        return { ...req, url: `${req.url}?rewritten=1` };
      },
    });
    await client.fetch('/jobs');
    expect(seen[0]!.url).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs',
    );
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs?rewritten=1',
    );
  });

  it('an async onRequest is awaited', async () => {
    const spy = stubFetch();
    const client = makeClient({
      onRequest: async (req) => ({ ...req, url: `${req.url}?async=1` }),
    });
    await client.fetch('/jobs');
    expect(spy.mock.calls[0]![0]).toContain('?async=1');
  });

  it('onResponse may consume the response body without breaking client parsing', async () => {
    stubFetch(jsonResponse({ object: 'list', data: [] }));
    const seenBodies: unknown[] = [];
    const client = makeClient({
      onResponse: async (res) => {
        seenBodies.push(await res.json());
      },
    });
    await expect(client.fetch('/jobs')).resolves.toEqual({
      object: 'list',
      data: [],
    });
    expect(seenBodies).toEqual([{ object: 'list', data: [] }]);
  });

  it('onResponse receives the Response and BoardRequest, for error statuses too', async () => {
    stubFetch(() =>
      jsonResponse({ error: { code: 'boards_not_found', message: 'no' } }, 404),
    );
    const onResponse = vi.fn<(res: Response, req: BoardRequest) => void>();
    const client = makeClient({ onResponse });
    await expect(client.fetch('/jobs')).rejects.toThrow(BoardApiError);
    expect(onResponse).toHaveBeenCalledOnce();
    const [res, req] = onResponse.mock.calls[0]!;
    expect(res.status).toBe(404);
    expect(req.url).toContain('/jobs');
  });
});

describe('logging', () => {
  it('redacts all query values while preserving parameter names', async () => {
    stubFetch();
    const logger = { debug: vi.fn(), error: vi.fn() };

    await makeClient({ logger }).fetch('/job-alerts/manage', {
      query: {
        token: 'secret-token',
        email: 'person@example.com',
        page: 2,
      },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'token=%5BREDACTED%5D&email=%5BREDACTED%5D&page=%5BREDACTED%5D',
      ),
    );
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain(
      'secret-token',
    );
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain(
      'person@example.com',
    );
  });

  it('redacts query values from a relative URL returned by onRequest', () => {
    expect(redactUrlForLog('/jobs?token=abc&cursor=def')).toBe(
      '/jobs?token=[REDACTED]&cursor=[REDACTED]',
    );
  });
});

describe('response parsing and errors', () => {
  it('204 resolves to undefined', async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    await expect(makeClient().fetch('/auth/logout')).resolves.toBeUndefined();
  });

  it('2xx JSON body is returned as-is', async () => {
    stubFetch(jsonResponse({ object: 'list', data: [] }));
    await expect(makeClient().fetch('/jobs')).resolves.toEqual({
      object: 'list',
      data: [],
    });
  });

  it('error envelope maps to BoardApiError with code, message, details, requestId, raw', async () => {
    const envelope = {
      error: {
        code: 'validation_bad_request',
        message: 'Request validation failed',
        details: { issues: [] },
        requestId: 'req_xyz',
      },
    };
    stubFetch(() => jsonResponse(envelope, 400));
    const err = await makeClient()
      .fetch('/jobs')
      .catch((e: unknown) => e as BoardApiError);
    expect(err).toBeInstanceOf(BoardApiError);
    const apiErr = err as BoardApiError;
    expect(apiErr.status).toBe(400);
    expect(apiErr.code).toBe('validation_bad_request');
    expect(apiErr.message).toBe('Request validation failed');
    expect(apiErr.details).toEqual({ issues: [] });
    expect(apiErr.requestId).toBe('req_xyz');
    expect(apiErr.raw).toEqual(envelope);
  });

  it('a 401 surfaces via isUnauthorized with no hidden retry', async () => {
    const spy = stubFetch(() =>
      jsonResponse(
        { error: { code: 'auth_invalid_token', message: 'no' } },
        401,
      ),
    );
    const err = await makeClient()
      .fetch('/me')
      .catch((e: unknown) => e);
    expect(isUnauthorized(err)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a non-JSON error body maps to unknown_error with the response status', async () => {
    stubFetch(
      () =>
        new Response('<html>Bad Gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
    );
    const err = await makeClient()
      .fetch('/jobs')
      .catch((e: unknown) => e as BoardApiError);
    const apiErr = err as BoardApiError;
    expect(apiErr).toBeInstanceOf(BoardApiError);
    expect(apiErr.status).toBe(502);
    expect(apiErr.code).toBe('unknown_error');
    expect(apiErr.message).toBe('Bad Gateway');
  });

  it('a network rejection from fetch propagates unwrapped', async () => {
    const boom = new TypeError('fetch failed');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw boom;
      }),
    );
    await expect(makeClient().fetch('/jobs')).rejects.toBe(boom);
  });
});
