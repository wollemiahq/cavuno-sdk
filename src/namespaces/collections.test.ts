import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

afterEach(() => vi.unstubAllGlobals());

describe('public collection entries', () => {
  it('encodes the key and preserves pagination and board access headers', async () => {
    const body = {
      data: [{ id: 'entry-1', name: 'Builders Guild', fields: [], values: {} }],
      nextCursor: 'page:2',
    };
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const board = createBoardClient({
      baseUrl: 'https://api.cavuno.com',
      board: 'example',
    });
    expect(
      await board.collections.entries(
        'trade communities',
        { cursor: 'page:1', limit: 5 },
        { headers: { 'x-board-password': 'test-grant' } },
      ),
    ).toEqual(body);
    const [input, init] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.pathname).toBe(
      '/v1/boards/example/collections/trade%20communities/entries',
    );
    expect(url.searchParams.get('cursor')).toBe('page:1');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(new Headers(init?.headers).get('x-board-password')).toBe(
      'test-grant',
    );
  });
});
