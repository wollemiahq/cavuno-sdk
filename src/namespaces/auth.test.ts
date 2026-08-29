import { afterEach, describe, expect, it, vi } from 'vitest';

import { BoardApiError, isUnauthorized } from '../errors';
import { createBoardClient } from '../index';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  resolveStorage,
} from '../storage';

import type { BoardAuthSession } from '../types/auth';

const SESSION: BoardAuthSession = {
  object: 'board_auth_session',
  accessToken: 'access-jwt',
  refreshToken: 'refresh-opaque',
  expiresAt: 1765432100000,
  boardUser: {
    id: 'user_1',
    object: 'board_user',
    role: 'candidate',
    email: 'a@b.com',
    displayName: 'A',
    emailVerified: false,
    hasPassword: true,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response | (() => Response)) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    typeof response === 'function' ? response() : response.clone(),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function makeBoard(storage = resolveStorage('memory')) {
  const board = createBoardClient({
    baseUrl: 'https://api.cavuno.com',
    board: 'acme-jobs',
    auth: { storage },
  });
  return { board, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth.login', () => {
  it('POSTs credentials to /auth/login and returns the board_auth_session', async () => {
    const spy = stubFetch(jsonResponse(SESSION));
    const { board } = makeBoard();
    const session = await board.auth.login({ email: 'a@b.com', password: 'x' });
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/auth/login',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"email":"a@b.com","password":"x"}',
    );
    expect(session).toEqual(SESSION);
  });

  it('persists accessToken and refreshToken to storage', async () => {
    stubFetch(jsonResponse(SESSION));
    const { board, storage } = makeBoard();
    await board.auth.login({ email: 'a@b.com', password: 'x' });
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('access-jwt');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-opaque');
  });

  it('subsequent requests carry the new bearer token', async () => {
    const spy = stubFetch(jsonResponse(SESSION));
    const { board } = makeBoard();
    await board.auth.login({ email: 'a@b.com', password: 'x' });
    await board.me.retrieve();
    const headers = spy.mock.calls[1]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer access-jwt');
  });
});

describe('auth.register', () => {
  it('POSTs to /auth/register and persists tokens like login', async () => {
    const spy = stubFetch(jsonResponse(SESSION, 201));
    const { board, storage } = makeBoard();
    const session = await board.auth.register({
      role: 'candidate',
      method: 'emailpass',
      email: 'a@b.com',
      password: 'longenough',
      displayName: 'A',
    });
    expect(spy.mock.calls[0]![0]).toContain('/auth/register');
    expect(session.object).toBe('board_auth_session');
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('access-jwt');
  });
});

describe('auth.refresh', () => {
  it('uses the stored refresh token when no body is given and persists the rotated pair', async () => {
    const rotated = {
      ...SESSION,
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    };
    const spy = stubFetch(jsonResponse(rotated));
    const { board, storage } = makeBoard();
    await storage.setItem(REFRESH_TOKEN_KEY, 'refresh-opaque');
    await board.auth.refresh();
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"refreshToken":"refresh-opaque"}',
    );
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('access-2');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('with an explicit { refreshToken } sends it and skips the storage read', async () => {
    const spy = stubFetch(jsonResponse(SESSION));
    const { board, storage } = makeBoard();
    await storage.setItem(REFRESH_TOKEN_KEY, 'stored-token');
    await board.auth.refresh({ refreshToken: 'explicit-token' });
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"refreshToken":"explicit-token"}',
    );
  });

  it('throws when no refresh token is available anywhere', async () => {
    stubFetch(jsonResponse(SESSION));
    const { board } = makeBoard(resolveStorage('nostore'));
    await expect(board.auth.refresh()).rejects.toThrow(/refresh token/i);
  });
});

describe('auth.logout', () => {
  it('sends the stored refresh token, resolves void on 204, and clears both keys', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const { board, storage } = makeBoard();
    await storage.setItem(ACCESS_TOKEN_KEY, 'access-jwt');
    await storage.setItem(REFRESH_TOKEN_KEY, 'refresh-opaque');
    await expect(board.auth.logout()).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"refreshToken":"refresh-opaque"}',
    );
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('throws when no refresh token is available anywhere', async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const { board } = makeBoard(resolveStorage('nostore'));
    await expect(board.auth.logout()).rejects.toThrow(/refresh token/i);
  });
});

describe('token-action endpoints', () => {
  it('verifyWorkEmail POSTs the token to /auth/verify-work-email with no slug', async () => {
    // The whole point of the flat path: an employer following an email link
    // has only a token, so nothing in the request may name a company.
    const spy = stubFetch(
      () =>
        new Response(
          JSON.stringify({ id: 'cm_1', object: 'company_membership' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const { board } = makeBoard();

    await expect(
      board.auth.verifyWorkEmail({ token: 't3' }),
    ).resolves.toMatchObject({ id: 'cm_1' });
    expect(spy.mock.calls[0]![0]).toContain('/auth/verify-work-email');
    expect(spy.mock.calls[0]![0]).not.toContain('/companies/');
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('verifyEmail, forgotPassword, and resetPassword POST their bodies and resolve void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const { board } = makeBoard();
    await expect(
      board.auth.verifyEmail({ token: 't1' }),
    ).resolves.toBeUndefined();
    await expect(
      board.auth.forgotPassword({ email: 'a@b.com' }),
    ).resolves.toBeUndefined();
    await expect(
      board.auth.resetPassword({ token: 't2', password: 'newpassword' }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toContain('/auth/verify-email');
    expect(spy.mock.calls[1]![0]).toContain('/auth/forgot-password');
    expect(spy.mock.calls[2]![0]).toContain('/auth/reset-password');
    for (const call of spy.mock.calls) {
      expect(call[1]!.method).toBe('POST');
    }
  });
});

describe('auth.magicLink', () => {
  it('requestMagicLink POSTs the email and return path, resolving void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const { board } = makeBoard();

    await expect(
      board.auth.requestMagicLink({
        email: 'a@b.com',
        returnTo: '/account',
      }),
    ).resolves.toBeUndefined();

    expect(spy.mock.calls[0]![0]).toContain('/auth/magic-link');
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"email":"a@b.com","returnTo":"/account"}',
    );
  });

  it('consumeMagicLink POSTs the token, persists the returned bearer pair, and returns it', async () => {
    const spy = stubFetch(jsonResponse(SESSION));
    const { board, storage } = makeBoard();

    const session = await board.auth.consumeMagicLink({ token: 't1' });

    expect(spy.mock.calls[0]![0]).toContain('/auth/magic-link/consume');
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"t1"}');
    expect(session).toEqual(SESSION);
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('access-jwt');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-opaque');
  });
});

describe('auth.oauth', () => {
  it('getOAuthAuthorizationUrl GETs the provider authorize URL with query params', async () => {
    const spy = stubFetch(
      jsonResponse({
        object: 'oauth_authorization_url',
        provider: 'google',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      }),
    );
    const { board } = makeBoard();

    const result = await board.auth.getOAuthAuthorizationUrl('google', {
      returnTo: '/account',
    });

    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/auth/oauth/google?returnTo=%2Faccount',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('GET');
    expect(result.authorizeUrl).toContain('accounts.google.com');
  });

  it('exchangeOAuth POSTs the one-time token, persists the bearer pair, and returns it', async () => {
    const spy = stubFetch(jsonResponse(SESSION));
    const { board, storage } = makeBoard();

    const session = await board.auth.exchangeOAuth({ token: 't1' });

    expect(spy.mock.calls[0]![0]).toContain('/auth/oauth/exchange');
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"t1"}');
    expect(session).toEqual(SESSION);
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('access-jwt');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-opaque');
  });
});

describe('expired-token behavior', () => {
  it('a 401 surfaces as BoardApiError via isUnauthorized with fetch called exactly once (no hidden refresh retry)', async () => {
    const spy = stubFetch(() =>
      jsonResponse(
        { error: { code: 'auth_invalid_token', message: 'expired' } },
        401,
      ),
    );
    const { board, storage } = makeBoard();
    await storage.setItem(ACCESS_TOKEN_KEY, 'stale');
    const err = await board.me.retrieve().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BoardApiError);
    expect(isUnauthorized(err)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('auth.verifyEmailWithCode + resendVerification', () => {
  it('verifyEmailWithCode POSTs the code to /auth/verify-email/otp with the bearer', async () => {
    const spy = stubFetch(new Response(null, { status: 204 }));
    const { board, storage } = makeBoard();
    await storage.setItem(ACCESS_TOKEN_KEY, 'jwt');

    await expect(
      board.auth.verifyEmailWithCode({ code: '123456' }),
    ).resolves.toBeUndefined();

    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/auth/verify-email/otp',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"code":"123456"}');
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('resendVerification POSTs /auth/verify-email/resend with the bearer and no body', async () => {
    const spy = stubFetch(new Response(null, { status: 204 }));
    const { board, storage } = makeBoard();
    await storage.setItem(ACCESS_TOKEN_KEY, 'jwt');

    await expect(board.auth.resendVerification()).resolves.toBeUndefined();

    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/auth/verify-email/resend',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBeUndefined();
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });
});
