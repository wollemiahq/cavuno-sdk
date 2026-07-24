import { describe, expect, it, vi } from 'vitest';

import { BoardApiError } from '../errors';
import { NOSTORE } from '../storage';
import { createSessionRefresher } from './refresher';

import type { BoardSdk } from '../index';
import type { BoardAuthSession } from '../types/auth';
import type { BoardSession } from './session';

const SESSION: BoardSession = {
  accessToken: 'old.jwt',
  refreshToken: 'brt_old',
  expiresAt: 1781300000000,
};

const ROTATED_WIRE: BoardAuthSession = {
  object: 'board_auth_session',
  accessToken: 'new.jwt',
  refreshToken: 'brt_new',
  expiresAt: 1781303600000,
  boardUser: {
    id: 'bu_1',
    object: 'board_user',
    role: 'candidate',
    email: 'a@b.com',
    displayName: 'Ada',
    emailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as BoardAuthSession['boardUser'],
};

function boardWith(refresh: (...args: never[]) => unknown) {
  return { auth: { refresh }, client: { storage: NOSTORE } } as unknown as Pick<
    BoardSdk,
    'auth' | 'client'
  >;
}

function unauthorized(): BoardApiError {
  return new BoardApiError({
    status: 401,
    code: 'board_auth_invalid_token',
    message: 'Refresh token is invalid or already used',
    raw: {},
  });
}

describe('createSessionRefresher (single-flight)', () => {
  it('maps a successful rotation to a BoardSession (wire boardUser/object dropped)', async () => {
    const refreshFn = vi.fn().mockResolvedValue(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    const next = await refresh(SESSION);

    expect(refreshFn).toHaveBeenCalledWith({ refreshToken: 'brt_old' });
    // The exact BoardSession shape — nothing extra rides along into the
    // cookie (boardUser would bloat it past header limits).
    expect(next).toEqual({
      accessToken: 'new.jwt',
      refreshToken: 'brt_new',
      expiresAt: 1781303600000,
    });
  });

  it('dedupes concurrent calls for the same refreshToken — ONE rotation, same promise', async () => {
    // The rotation race: refresh tokens are single-use,
    // so two concurrent refreshes burn the pair — the loser 401s and the
    // user is signed out mid-session. Both callers must share one flight.
    let release!: (value: BoardAuthSession) => void;
    const refreshFn = vi.fn().mockReturnValue(
      new Promise<BoardAuthSession>((resolve) => {
        release = resolve;
      }),
    );
    const refresh = createSessionRefresher(boardWith(refreshFn));

    const first = refresh(SESSION);
    const second = refresh(SESSION);
    release(ROTATED_WIRE);
    const [a, b] = await Promise.all([first, second]);

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).toEqual({
      accessToken: 'new.jwt',
      refreshToken: 'brt_new',
      expiresAt: 1781303600000,
    });
  });

  it('does NOT dedupe across different refreshTokens (per-token flight)', async () => {
    const refreshFn = vi.fn().mockResolvedValue(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await Promise.all([
      refresh(SESSION),
      refresh({ ...SESSION, refreshToken: 'brt_other' }),
    ]);

    expect(refreshFn).toHaveBeenCalledTimes(2);
  });

  it('sequential calls after settle re-invoke auth.refresh (slot cleared)', async () => {
    const refreshFn = vi.fn().mockResolvedValue(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await refresh(SESSION);
    await refresh(SESSION);

    expect(refreshFn).toHaveBeenCalledTimes(2);
  });

  it('returns null on a 401 (burned single-use token — caller signs out, never loops)', async () => {
    const refreshFn = vi.fn().mockRejectedValue(unauthorized());
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await expect(refresh(SESSION)).resolves.toBeNull();
  });

  it('treats a 401 as signed-out even when the error is a bundle-foreign BoardApiError', async () => {
    // `/server` and the core entry are separate bundles (no code splitting),
    // so `instanceof BoardApiError` can be FALSE for an error the core
    // client threw. The 401 check must be structural, not identity-based.
    const foreign = new Error('Refresh token is invalid or already used');
    foreign.name = 'BoardApiError';
    (foreign as Error & { status: number }).status = 401;
    (foreign as Error & { code: string }).code = 'board_auth_invalid_token';
    const refreshFn = vi.fn().mockRejectedValue(foreign);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await expect(refresh(SESSION)).resolves.toBeNull();
  });

  it('rethrows non-401 errors and clears the in-flight slot', async () => {
    const boom = new TypeError('fetch failed');
    const refreshFn = vi
      .fn()
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await expect(refresh(SESSION)).rejects.toBe(boom);
    // The slot must be cleared in finally — a retry gets a FRESH attempt,
    // not the cached rejection.
    await expect(refresh(SESSION)).resolves.toEqual({
      accessToken: 'new.jwt',
      refreshToken: 'brt_new',
      expiresAt: 1781303600000,
    });
    expect(refreshFn).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-401 BoardApiError (e.g. 429) instead of signing out', async () => {
    const limited = new BoardApiError({
      status: 429,
      code: 'rate_limited',
      message: 'Too many requests',
      raw: {},
    });
    const refreshFn = vi.fn().mockRejectedValue(limited);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await expect(refresh(SESSION)).rejects.toBe(limited);
  });
});

describe('construction storage guard', () => {
  it('throws off-browser when the shared client storage is not nostore', () => {
    // A persistent shared store would bleed rotated tokens across requests
    // (auth.refresh persists into client.storage) — fail loud at wiring time.
    const persistent = {
      auth: { refresh: async () => ({}) },
      client: {
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    } as unknown as Pick<BoardSdk, 'auth' | 'client'>;
    expect(() => createSessionRefresher(persistent)).toThrow(/nostore/);
    // A independent bundle copy of the sentinel (same global-symbol brand,
    // different object identity — what dist consumers actually pass) must
    // construct fine: the check is structural, never identity.
    const foreignNostore = {
      auth: { refresh: async () => ({}) },
      client: {
        storage: {
          [Symbol.for('@cavuno/board:nostore')]: true,
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    } as unknown as Pick<BoardSdk, 'auth' | 'client'>;
    expect(() => createSessionRefresher(foreignNostore)).not.toThrow();
  });
});
