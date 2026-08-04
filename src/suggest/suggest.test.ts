import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { createSuggestController } from './index';

import type { SuggestResult, SuggestionItem } from '../types/search';

function company(
  slug: string,
  name = slug,
): Extract<SuggestionItem, { type: 'company' }> {
  return {
    object: 'suggestion',
    type: 'company',
    id: `companies_${slug}`,
    slug,
    name,
    logoUrl: null,
    jobCount: 3,
  };
}

function term(
  displayName: string,
  termType: 'category' | 'skill' = 'category',
): Extract<SuggestionItem, { type: 'term' }> {
  return {
    object: 'suggestion',
    type: 'term',
    termType,
    id: `terms_${displayName}`,
    sourceSlug: displayName.toLowerCase(),
    canonicalSlug: displayName.toLowerCase(),
    displayName,
  };
}

function result(query: string, items: SuggestionItem[]): SuggestResult {
  return { object: 'suggest_result', query, items };
}

function mockBoard(impl?: Mock) {
  const suggest =
    impl ??
    vi.fn(async () => result('acme', [company('acme'), term('Accounting')]));
  return {
    board: { search: { suggest } },
    suggest,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSuggestController', () => {
  it('stays idle and clears items when query is below minChars', () => {
    const { board, suggest } = mockBoard();
    const ctrl = createSuggestController(board, { minChars: 2 });

    ctrl.setQuery('a');
    expect(ctrl.getState()).toEqual({
      query: 'a',
      items: [],
      status: 'idle',
      error: null,
    });
    expect(suggest).not.toHaveBeenCalled();

    ctrl.setQuery('  '); // trims for the length check
    expect(ctrl.getState().status).toBe('idle');
    expect(suggest).not.toHaveBeenCalled();
  });

  it('counts graphemes for minChars so a single CJK character qualifies', async () => {
    const { board, suggest } = mockBoard(
      vi.fn(async () => result('日', [term('日', 'skill')])),
    );
    const ctrl = createSuggestController(board, { minChars: 1, debounceMs: 0 });

    // One CJK code point is one grapheme — must not be blocked as length 1 UTF-16.
    ctrl.setQuery('日');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0]![0]).toEqual({ q: '日' });
  });

  it('debounces: only the last setQuery within debounceMs fires', async () => {
    const { board, suggest } = mockBoard();
    const ctrl = createSuggestController(board, { debounceMs: 250 });

    ctrl.setQuery('ac');
    ctrl.setQuery('acm');
    ctrl.setQuery('acme');
    expect(suggest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(249);
    expect(suggest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0]![0]).toEqual({ q: 'acme' });
  });

  it('retains previous items while loading (no flash-to-empty)', async () => {
    let resolveFirst!: (v: SuggestResult) => void;
    const first = new Promise<SuggestResult>((r) => {
      resolveFirst = r;
    });
    let resolveSecond!: (v: SuggestResult) => void;
    const second = new Promise<SuggestResult>((r) => {
      resolveSecond = r;
    });

    const suggest = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second);
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    expect(ctrl.getState().status).toBe('loading');

    resolveFirst(result('acme', [company('acme')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('ready');
    expect(ctrl.getState().items).toEqual([company('acme')]);

    ctrl.setQuery('globex');
    await vi.advanceTimersByTimeAsync(0);
    // Previous items retained while the new request is in flight.
    expect(ctrl.getState().status).toBe('loading');
    expect(ctrl.getState().items).toEqual([company('acme')]);

    resolveSecond(result('globex', [company('globex')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().items).toEqual([company('globex')]);
  });

  it('aborts in-flight requests and drops stale resolutions', async () => {
    let resolveSlow!: (v: SuggestResult) => void;

    const realSuggest = vi.fn(
      async (q?: { q?: string }, opts?: { signal?: AbortSignal }) => {
        if (q?.q === 'slow') {
          return new Promise<SuggestResult>((resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
            resolveSlow = resolve;
          });
        }
        return result('fast', [company('fast'), term('Finance')]);
      },
    );

    const ctrl = createSuggestController(
      { search: { suggest: realSuggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('slow');
    await vi.advanceTimersByTimeAsync(0);
    expect(realSuggest).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().status).toBe('loading');

    ctrl.setQuery('fast');
    await vi.advanceTimersByTimeAsync(0);
    expect(realSuggest).toHaveBeenCalledTimes(2);

    // Stale slow resolution must be ignored (also aborted).
    resolveSlow(result('slow', [company('stale')]));
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.getState().status).toBe('ready');
    expect(
      ctrl
        .getState()
        .items.map((i) => ('slug' in i ? i.slug : i.displayName)),
    ).toEqual(['fast', 'Finance']);
  });

  it('passes AbortSignal via FetchOptions and aborts on superseding query', async () => {
    const signals: AbortSignal[] = [];
    const suggest = vi.fn(
      async (_q?: unknown, opts?: { signal?: AbortSignal }) => {
        if (opts?.signal) signals.push(opts.signal);
        return new Promise<SuggestResult>(() => {
          /* never resolves — aborted */
        });
      },
    );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('first');
    await vi.advanceTimersByTimeAsync(0);
    ctrl.setQuery('second');
    await vi.advanceTimersByTimeAsync(0);

    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it('drops A when it resolves during B debounce window', async () => {
    let resolveA!: (v: SuggestResult) => void;
    let resolveB!: (v: SuggestResult) => void;
    const suggest = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((r) => {
            resolveA = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((r) => {
            resolveB = r;
          }),
      );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 250 },
    );

    ctrl.setQuery('aa');
    await vi.advanceTimersByTimeAsync(250);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().status).toBe('loading');

    // B supersedes A during A's in-flight window; debounce restarts.
    ctrl.setQuery('aaa');
    expect(ctrl.getState().status).toBe('loading');
    expect(ctrl.getState().error).toBeNull();
    expect(suggest).toHaveBeenCalledTimes(1); // B not fired yet

    // A resolves while B is still debouncing — must not become ready with A's items.
    resolveA(result('aa', [company('aa-corp')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('loading');
    expect(ctrl.getState().items).toEqual([]);
    expect(ctrl.getState().query).toBe('aaa');

    await vi.advanceTimersByTimeAsync(250);
    expect(suggest).toHaveBeenCalledTimes(2);

    resolveB(result('aaa', [company('aaa-corp')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('ready');
    expect(ctrl.getState().items).toEqual([company('aaa-corp')]);
  });

  it('drops stale resolution when fetch ignores abort (seq-only guard)', async () => {
    let resolveFirst!: (v: SuggestResult) => void;
    let resolveSecond!: (v: SuggestResult) => void;
    const suggest = vi.fn(
      async (q?: { q?: string }, _opts?: { signal?: AbortSignal }) => {
        // Intentionally ignore abort — promise never rejects on signal.
        return new Promise<SuggestResult>((resolve) => {
          if (q?.q === 'first') resolveFirst = resolve;
          else resolveSecond = resolve;
        });
      },
    );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('first');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest).toHaveBeenCalledTimes(1);

    ctrl.setQuery('second');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest).toHaveBeenCalledTimes(2);

    // First resolves AFTER second request has started — must be dropped.
    resolveFirst(result('first', [company('stale')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('loading');
    expect(
      ctrl.getState().items.map((i) => ('slug' in i ? i.slug : i.displayName)),
    ).not.toContain('stale');

    resolveSecond(result('second', [company('fresh')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('ready');
    expect(ctrl.getState().items).toEqual([company('fresh')]);
  });

  it('does not surface error from a superseded request', async () => {
    let rejectA!: (e: unknown) => void;
    let resolveB!: (v: SuggestResult) => void;
    const boom = new Error('network down');
    const suggest = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((_resolve, reject) => {
            rejectA = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((resolve) => {
            resolveB = resolve;
          }),
      );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('aa');
    await vi.advanceTimersByTimeAsync(0);

    ctrl.setQuery('bb');
    await vi.advanceTimersByTimeAsync(0);

    rejectA(boom);
    await Promise.resolve();
    await Promise.resolve();
    // Superseded failure must not become error; B still in flight.
    expect(ctrl.getState().status).toBe('loading');
    expect(ctrl.getState().error).toBeNull();

    resolveB(result('bb', [company('bb-corp')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('ready');
    expect(ctrl.getState().items).toEqual([company('bb-corp')]);
    expect(ctrl.getState().error).toBeNull();
  });

  it('clears error on retype while retaining previous items', async () => {
    const boom = new Error('network down');
    let resolveFirst!: (v: SuggestResult) => void;
    let rejectSecond!: (e: unknown) => void;
    const suggest = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<SuggestResult>((_resolve, reject) => {
            rejectSecond = reject;
          }),
      )
      .mockImplementationOnce(async () => result('bb', [company('bb-corp')]));
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('aa');
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst(result('aa', [company('aa-corp')]));
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().items).toEqual([company('aa-corp')]);

    ctrl.setQuery('ab');
    await vi.advanceTimersByTimeAsync(0);
    rejectSecond(boom);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().status).toBe('error');
    expect(ctrl.getState().error).toBe(boom);
    expect(ctrl.getState().items).toEqual([company('aa-corp')]);

    // Retype with valid query: immediate loading, error cleared, items retained.
    ctrl.setQuery('bb');
    expect(ctrl.getState().status).toBe('loading');
    expect(ctrl.getState().error).toBeNull();
    expect(ctrl.getState().items).toEqual([company('aa-corp')]);
  });

  it('applies exclusions set mid-flight to the resolving response', async () => {
    let resolveFirst!: (v: SuggestResult) => void;
    const suggest = vi.fn(
      async () =>
        new Promise<SuggestResult>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('ac');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().status).toBe('loading');

    // Exclusion applied while request is in flight.
    ctrl.setExcludedCompanySlugs(['acme']);

    resolveFirst(
      result('ac', [company('acme'), term('Accounting'), company('globex')]),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.getState().status).toBe('ready');
    expect(ctrl.getState().items).toEqual([
      term('Accounting'),
      company('globex'),
    ]);
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it('filters excluded company slugs on success and re-filters synchronously', async () => {
    const items: SuggestionItem[] = [
      company('acme'),
      term('Accounting'),
      company('globex'),
    ];
    const { board } = mockBoard(
      vi.fn(async () => result('a', items)),
    );
    const ctrl = createSuggestController(board, { debounceMs: 0 });

    ctrl.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().items).toHaveLength(3);

    ctrl.setExcludedCompanySlugs(['acme']);
    // Synchronous re-filter — no extra request.
    expect(ctrl.getState().items).toEqual([term('Accounting'), company('globex')]);
    expect(board.search.suggest).toHaveBeenCalledTimes(1);

    // Term items are never excluded by company slug.
    ctrl.setExcludedCompanySlugs(['accounting']);
    expect(ctrl.getState().items).toEqual(items);
  });

  it('on non-abort failure sets status error and retains previous items', async () => {
    const boom = new Error('network down');
    const suggest = vi
      .fn()
      .mockResolvedValueOnce(result('acme', [company('acme')]))
      .mockRejectedValueOnce(boom);
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.getState().items).toEqual([company('acme')]);

    ctrl.setQuery('globex');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.getState().status).toBe('error');
    expect(ctrl.getState().error).toBe(boom);
    expect(ctrl.getState().items).toEqual([company('acme')]);
  });

  it('treats aborts as silent (no error state)', async () => {
    const suggest = vi.fn(async (_q?: unknown, opts?: { signal?: AbortSignal }) => {
      return new Promise<SuggestResult>((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );

    ctrl.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    // Drop below minChars → abort in-flight, idle, no error.
    ctrl.setQuery('a');
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.getState()).toEqual({
      query: 'a',
      items: [],
      status: 'idle',
      error: null,
    });
  });

  it('getState returns a stable reference between changes; notify on change', async () => {
    const { board } = mockBoard();
    const ctrl = createSuggestController(board, { debounceMs: 0 });
    const listener = vi.fn();
    ctrl.subscribe(listener);

    const s0 = ctrl.getState();
    expect(ctrl.getState()).toBe(s0);

    ctrl.setQuery('acme');
    expect(listener).toHaveBeenCalled();
    const s1 = ctrl.getState();
    expect(s1).not.toBe(s0);
    expect(ctrl.getState()).toBe(s1);

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    const s2 = ctrl.getState();
    expect(s2.status).toBe('ready');
    expect(ctrl.getState()).toBe(s2);
  });

  it('subscribe returns an unsubscribe function', () => {
    const { board } = mockBoard();
    const ctrl = createSuggestController(board);
    const listener = vi.fn();
    const unsub = ctrl.subscribe(listener);
    ctrl.setQuery('x');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    ctrl.setQuery('y');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dispose cancels timer, aborts in-flight, clears listeners; further dispose is a no-op', async () => {
    const signals: AbortSignal[] = [];
    const suggest = vi.fn(
      async (_q?: unknown, opts?: { signal?: AbortSignal }) => {
        if (opts?.signal) signals.push(opts.signal);
        return new Promise<SuggestResult>(() => {});
      },
    );
    const ctrl = createSuggestController(
      { search: { suggest } },
      { debounceMs: 100 },
    );
    const listener = vi.fn();
    ctrl.subscribe(listener);

    ctrl.setQuery('acme');
    // Dispose before debounce fires.
    ctrl.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(suggest).not.toHaveBeenCalled();

    // Dispose mid-flight.
    const ctrl2 = createSuggestController(
      { search: { suggest } },
      { debounceMs: 0 },
    );
    const listener2 = vi.fn();
    ctrl2.subscribe(listener2);
    ctrl2.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest).toHaveBeenCalledTimes(1);
    ctrl2.dispose();
    expect(signals[0]!.aborted).toBe(true);

    // Subsequent dispose + setQuery are no-ops.
    ctrl2.dispose();
    const callsBefore = listener2.mock.calls.length;
    ctrl2.setQuery('globex');
    await vi.advanceTimersByTimeAsync(0);
    expect(listener2).toHaveBeenCalledTimes(callsBefore);
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it('passes limit through to the server', async () => {
    const { board, suggest } = mockBoard();
    const ctrl = createSuggestController(board, { debounceMs: 0, limit: 10 });
    ctrl.setQuery('acme');
    await vi.advanceTimersByTimeAsync(0);
    expect(suggest.mock.calls[0]![0]).toEqual({ q: 'acme', limit: 10 });
  });

  it('is SSR-safe: module has no window/document side effects', () => {
    // Import already succeeded under vitest (node). Confirm create does not
    // touch window.
    const g = globalThis as { window?: unknown; document?: unknown };
    const hadWindow = 'window' in g;
    const hadDocument = 'document' in g;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    if (hadWindow) delete g.window;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    if (hadDocument) delete g.document;

    const { board } = mockBoard();
    expect(() => createSuggestController(board)).not.toThrow();

    // Restore nothing — vitest node has no window by default.
    void hadWindow;
    void hadDocument;
  });
});
