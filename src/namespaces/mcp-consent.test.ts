import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

function stubFetch() {
  const spy = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ next: 'error' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const board = () =>
  createBoardClient({ baseUrl: 'https://api.cavuno.com', board: 'acme-jobs' });

afterEach(() => vi.unstubAllGlobals());

describe('board.mcpConsent', () => {
  it('get passes the page query on unchanged, with or without its `?`', async () => {
    const search =
      '?response_type=code&client_id=https%3A%2F%2Fclaude.ai%2Fclient&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=a%2Bb';
    const spy = stubFetch();
    await board().mcpConsent.get(search);
    await board().mcpConsent.get(search.slice(1));
    await board().mcpConsent.get('');
    expect(spy.mock.calls.map(([url]) => url)).toEqual([
      `${BASE}/mcp/consent${search}`,
      `${BASE}/mcp/consent${search}`,
      `${BASE}/mcp/consent`,
    ]);
  });

  it('submit posts the decision with the caller headers', async () => {
    const spy = stubFetch();
    const body = {
      request: 'eyJ9',
      consentToken: '1.sig',
      decision: 'deny' as const,
    };
    await board().mcpConsent.submit(body, {
      headers: { authorization: 'Bearer t' },
    });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe(`${BASE}/mcp/consent`);
    expect(init!.method).toBe('POST');
    expect(JSON.parse(String(init!.body))).toEqual(body);
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer t');
  });
});
