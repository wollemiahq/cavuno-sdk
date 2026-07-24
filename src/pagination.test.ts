import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from './index';
import { paginate } from './pagination';

import type { FetchOptions } from './client';
import type { ListEnvelope } from './types/common';

// The cursor contract (01-conventions.md §7): opaque forward-only tokens,
// echoed verbatim; `hasMore: false` / `nextCursor: null` terminates. The
// helper exists so sitemap-scale consumers (and coding agents) never
// hand-roll the walk — and never hit the offset-precedence footgun.

function page<T>(data: T[], nextCursor: string | null): ListEnvelope<T> {
  return {
    object: 'list',
    url: '/v1/boards/acme-jobs/jobs',
    hasMore: nextCursor !== null,
    nextCursor,
    data,
  };
}

function fakeList(pages: ListEnvelope<number>[]) {
  const calls: Array<{
    query?: Record<string, unknown>;
    options?: FetchOptions;
  }> = [];
  let i = 0;
  const fn = async (
    query?: Record<string, unknown>,
    options?: FetchOptions,
  ) => {
    calls.push({ query, options });
    const p = pages[i];
    if (!p) throw new Error('fetched past the last page');
    i += 1;
    return p;
  };
  return { fn, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('paginate', () => {
  it('iterates every item across pages, echoing cursors forward', async () => {
    const { fn, calls } = fakeList([
      page([1, 2], 'c1'),
      page([3], 'c2'),
      page([4], null),
    ]);

    const seen: number[] = [];
    for await (const item of paginate(fn, { limit: 2 })) seen.push(item);

    expect(seen).toEqual([1, 2, 3, 4]);
    expect(calls.map((c) => c.query)).toEqual([
      { limit: 2 },
      { limit: 2, cursor: 'c1' },
      { limit: 2, cursor: 'c2' },
    ]);
  });

  it('stops when hasMore is false even if data continues', async () => {
    const { fn, calls } = fakeList([page([1], null)]);
    const seen: number[] = [];
    for await (const item of paginate(fn)) seen.push(item);
    expect(seen).toEqual([1]);
    expect(calls).toHaveLength(1);
  });

  it('pages() yields the raw envelopes', async () => {
    const p1 = page([1, 2], 'c1');
    const p2 = page([3], null);
    const { fn } = fakeList([p1, p2]);

    const envelopes = [];
    for await (const envelope of paginate(fn).pages()) envelopes.push(envelope);
    expect(envelopes).toEqual([p1, p2]);
  });

  it('drops `offset` after the first page (offset takes precedence over cursor)', async () => {
    const { fn, calls } = fakeList([page([1], 'c1'), page([2], null)]);

    const seen: number[] = [];
    for await (const item of paginate(fn, { offset: 40, limit: 1 })) {
      seen.push(item);
    }

    expect(seen).toEqual([1, 2]);
    expect(calls[0]!.query).toEqual({ offset: 40, limit: 1 });
    // If offset rode along with the cursor, the server would serve page 1
    // forever (offset wins over cursor on job catalog reads).
    expect(calls[1]!.query).toEqual({ limit: 1, cursor: 'c1' });
  });

  it('toArray collects up to the required cap and stops fetching beyond it', async () => {
    const { fn, calls } = fakeList([
      page([1, 2], 'c1'),
      page([3, 4], 'c2'),
      page([5], null),
    ]);

    const items = await paginate(fn).toArray({ limit: 3 });
    expect(items).toEqual([1, 2, 3]);
    // The third page must never be fetched once the cap is hit.
    expect(calls).toHaveLength(2);
  });

  it('threads FetchOptions (signal, caching) into every page fetch', async () => {
    const { fn, calls } = fakeList([page([1], 'c1'), page([2], null)]);
    const controller = new AbortController();

    for await (const _ of paginate(fn, undefined, {
      signal: controller.signal,
    })) {
      // drain
    }

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.options?.signal).toBe(controller.signal);
    }
  });

  it('walks a real namespace list method through the client pipeline', async () => {
    const responses = [
      page([{ title: 'A' }], 'cur_2'),
      page([{ title: 'B' }], null),
    ];
    let call = 0;
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => {
      const body = responses[call];
      call += 1;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', spy);

    const board = createBoardClient({
      baseUrl: 'https://api.cavuno.com',
      board: 'acme-jobs',
    });

    const titles: string[] = [];
    for await (const job of paginate(board.jobs.list, { limit: 1 })) {
      titles.push((job as { title: string }).title);
    }

    expect(titles).toEqual(['A', 'B']);
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs?limit=1',
    );
    expect(spy.mock.calls[1]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/jobs?limit=1&cursor=cur_2',
    );
  });
});
