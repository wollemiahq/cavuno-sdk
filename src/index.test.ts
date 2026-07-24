import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createBoardClient API origin', () => {
  it('uses the Cavuno production API when baseUrl is omitted', async () => {
    const fetchSpy = vi.fn(async (_input: string) =>
      Response.json({ object: 'board', name: 'Acme jobs' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const board = createBoardClient({ board: 'pk_acme' });
    await board.context();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://api.cavuno.com/v1/boards/pk_acme',
    );
  });

  it('preserves an explicit API origin override', async () => {
    const fetchSpy = vi.fn(async (_input: string) =>
      Response.json({ object: 'board', name: 'Acme jobs' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const board = createBoardClient({
      baseUrl: 'https://api.staging.cavuno.example',
      board: 'pk_acme',
    });
    await board.context();

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://api.staging.cavuno.example/v1/boards/pk_acme',
    );
  });
});
