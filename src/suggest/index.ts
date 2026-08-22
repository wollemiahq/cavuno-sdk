/**
 * `@cavuno/board/suggest` — framework-agnostic headless search-suggest
 * controller (Algolia autocomplete-core pattern).
 *
 * Owns debounce, abort, and stale-drop so tenant frontends don't re-invent
 * them. Patches ship via npm update. Zero runtime deps; isomorphic
 * (`globalThis` timers only — never `window`/`document`).
 *
 * The ONE permitted view-level filter is excluding currently-applied company
 * slugs from results (type `company` only). Wire data is never reshaped
 * otherwise — order stays server-ranked.
 */
import type { FetchOptions } from '../client';
import type {
  SearchSuggestQuery,
  SuggestResult,
  SuggestionItem,
} from '../types/search';

export interface SuggestControllerOptions {
  /** Minimum characters before querying (default 2 — hosted parity). */
  minChars?: number;
  /** Debounce for setQuery → request (default 250ms). */
  debounceMs?: number;
  /** Server `limit` passed through (1–25). */
  limit?: number;
}

export type SuggestStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SuggestState {
  readonly query: string;
  /**
   * Server-ranked items. Previous items are RETAINED while a new request
   * is loading (no flash-to-empty — hosted behavior).
   */
  readonly items: readonly SuggestionItem[];
  /**
   * `'loading'` from the moment a qualifying query is set (debounce window
   * included) until that query's request settles. `'idle'` only when the
   * query is empty/below minChars. `'ready'` / `'error'` after settle.
   */
  readonly status: SuggestStatus;
  readonly error: unknown;
}

export interface SuggestController {
  setQuery(query: string): void;
  /** Company slugs to hide from results (e.g. the currently-applied filter). */
  setExcludedCompanySlugs(slugs: readonly string[]): void;
  getState(): SuggestState;
  /** Returns an unsubscribe function. Compatible with useSyncExternalStore. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

type SuggestBoard = {
  search: {
    suggest(q?: SearchSuggestQuery, o?: FetchOptions): Promise<SuggestResult>;
  };
};

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 250;

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Grapheme length for minChars. UTF-16 `.length` blocks single CJK/Hangul/
 * Thai/Devanagari terms (1 code unit) while allowing emoji (2). Prefer
 * `Intl.Segmenter`; fall back to code-point count.
 */
function queryCharCount(query: string): number {
  try {
    let n = 0;
    for (const _ of new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    }).segment(query)) {
      n += 1;
    }
    return n;
  } catch {
    return [...query].length;
  }
}

/**
 * Apply the view-level company-slug exclusion to a server-ranked list.
 * Only `type: 'company'` items are filtered; term items pass through.
 * Order is preserved.
 */
function applyExclusions(
  items: readonly SuggestionItem[],
  excluded: ReadonlySet<string>,
): SuggestionItem[] {
  if (excluded.size === 0) return items.slice();
  return items.filter(
    (item) =>
      !(
        item.type === 'company' &&
        // NFC + toLowerCase — same keying as setExcludedCompanySlugs.
        excluded.has(item.slug.toLowerCase().normalize('NFC'))
      ),
  );
}

/**
 * Create a headless suggest controller bound to a board client (or any
 * object exposing `search.suggest`).
 *
 * @example
 * import { createBoardClient } from '@cavuno/board';
 * import { createSuggestController } from '@cavuno/board/suggest';
 *
 * const board = createBoardClient({ board: 'pk_…' });
 * const suggest = createSuggestController(board);
 * suggest.subscribe(() => render(suggest.getState()));
 * suggest.setQuery('acme');
 */
export function createSuggestController(
  board: SuggestBoard,
  options?: SuggestControllerOptions,
): SuggestController {
  const minChars = options?.minChars ?? DEFAULT_MIN_CHARS;
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const limit = options?.limit;

  let disposed = false;
  let state: SuggestState = {
    query: '',
    items: [],
    status: 'idle',
    error: null,
  };
  /** Last unfiltered server items — re-filter on exclusion changes. */
  let rawItems: readonly SuggestionItem[] = [];
  let excluded = new Set<string>();
  let sequence = 0;
  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let abortController: AbortController | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function setState(next: SuggestState): void {
    state = next;
    notify();
  }

  function cancelTimer(): void {
    if (timer !== null) {
      globalThis.clearTimeout(timer);
      timer = null;
    }
  }

  function abortInFlight(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  function runRequest(query: string): void {
    const seq = ++sequence;
    abortInFlight();
    const controller = new AbortController();
    abortController = controller;

    // Status is already 'loading' from setQuery; no duplicate notify.

    const suggestQuery: SearchSuggestQuery = { q: query };
    if (limit !== undefined) suggestQuery.limit = limit;

    void board.search
      .suggest(suggestQuery, { signal: controller.signal })
      .then((result) => {
        if (disposed || seq !== sequence) return;
        abortController = null;
        rawItems = result.items;
        setState({
          query: state.query,
          items: applyExclusions(rawItems, excluded),
          status: 'ready',
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (disposed || seq !== sequence) return;
        if (isAbortError(error)) return;
        abortController = null;
        setState({
          query: state.query,
          items: state.items,
          status: 'error',
          error,
        });
      });
  }

  return {
    setQuery(query: string): void {
      if (disposed) return;

      const trimmed = query.trim();
      cancelTimer();

      if (queryCharCount(trimmed) < minChars) {
        sequence += 1;
        abortInFlight();
        rawItems = [];
        setState({
          query,
          items: [],
          status: 'idle',
          error: null,
        });
        return;
      }

      // Invalidate any in-flight request for a previous query immediately —
      // even during this query's debounce window. Sequence is the backstop
      // if the underlying fetch ignores the abort signal.
      sequence += 1;
      abortInFlight();

      // Keep previous items while debouncing / loading (no flash-to-empty).
      // Status is 'loading' from the moment a qualifying query is set until
      // its request settles (debounce included). Error cleared immediately.
      setState({
        query,
        items: state.items,
        status: 'loading',
        error: null,
      });

      timer = globalThis.setTimeout(() => {
        timer = null;
        if (disposed) return;
        runRequest(trimmed);
      }, debounceMs);
    },

    setExcludedCompanySlugs(slugs: readonly string[]): void {
      if (disposed) return;
      excluded = new Set(
        slugs
          .map((s) => s.trim().toLowerCase().normalize('NFC'))
          .filter(Boolean),
      );
      // Re-filter CURRENT items synchronously — no new request.
      setState({
        query: state.query,
        items: applyExclusions(rawItems, excluded),
        status: state.status,
        error: state.error,
      });
    },

    getState(): SuggestState {
      return state;
    },

    subscribe(listener: () => void): () => void {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelTimer();
      abortInFlight();
      sequence += 1;
      listeners.clear();
    },
  };
}
