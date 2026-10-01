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
    hasPassword: true,
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

describe('createSessionRefresher', () => {
  it('maps a successful rotation to a BoardSession (wire boardUser/object dropped)', async () => {
    const refreshFn = vi.fn().mockResolvedValue(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    const next = await refresh(SESSION);

    expect(refreshFn).toHaveBeenCalledWith({ refreshToken: 'brt_old' });
    // The exact BoardSession shape: nothing extra rides along into the
    // cookie (boardUser would bloat it past header limits).
    expect(next).toEqual({
      accessToken: 'new.jwt',
      refreshToken: 'brt_new',
      expiresAt: 1781303600000,
    });
  });

  it('holds no shared state: concurrent calls for one session each call auth.refresh', async () => {
    // Concurrent refreshes converge server-side (the same token re-presented
    // within the grace window returns the same successor refresh token), so
    // the client keeps no in-flight slot to share between callers.
    const refreshFn = vi.fn().mockResolvedValue(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    const [a, b] = await Promise.all([refresh(SESSION), refresh(SESSION)]);

    expect(refreshFn).toHaveBeenCalledTimes(2);
    expect(refreshFn).toHaveBeenNthCalledWith(1, { refreshToken: 'brt_old' });
    expect(refreshFn).toHaveBeenNthCalledWith(2, { refreshToken: 'brt_old' });
    expect(a).toEqual(b);
  });

  it('a refresh that never settles does not block a later call for the same token', async () => {
    // Regression: on Workers a fetch belongs to the request that started it.
    // If that request is cancelled, the refresh promise never settles. A
    // later request presenting the same refresh token must still complete
    // instead of awaiting the abandoned promise forever.
    const refreshFn = vi
      .fn()
      .mockReturnValueOnce(new Promise<BoardAuthSession>(() => {}))
      .mockResolvedValueOnce(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    let firstSettled = false;
    void refresh(SESSION).finally(() => {
      firstSettled = true;
    });

    await expect(refresh(SESSION)).resolves.toEqual({
      accessToken: 'new.jwt',
      refreshToken: 'brt_new',
      expiresAt: 1781303600000,
    });
    expect(refreshFn).toHaveBeenCalledTimes(2);
    expect(firstSettled).toBe(false);
  });

  it('returns null on a 401 (expired or revoked token: caller signs out, never loops)', async () => {
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

  it('rethrows non-401 errors, and a retry makes a fresh attempt', async () => {
    const boom = new TypeError('fetch failed');
    const refreshFn = vi
      .fn()
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce(ROTATED_WIRE);
    const refresh = createSessionRefresher(boardWith(refreshFn));

    await expect(refresh(SESSION)).rejects.toBe(boom);
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
