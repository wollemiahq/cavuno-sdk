import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';
import { BOARD_ACCESS_GRANT_KEY, resolveStorage } from '../storage';

const GRANT = { object: 'board_access_grant', token: 'hmac-grant-hex' };

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

describe('password.verify', () => {
  it('POSTs the password to /password/verify and returns the grant', async () => {
    const spy = stubFetch(jsonResponse(GRANT));
    const { board } = makeBoard();
    const grant = await board.password.verify('correct-horse');
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/password/verify',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"password":"correct-horse"}');
    expect(grant).toEqual(GRANT);
  });

  it('persists the grant to storage', async () => {
    stubFetch(jsonResponse(GRANT));
    const { board, storage } = makeBoard();
    await board.password.verify('correct-horse');
    expect(await storage.getItem(BOARD_ACCESS_GRANT_KEY)).toBe(
      'hmac-grant-hex',
    );
  });

  it('does NOT persist a grant when the password is wrong (401)', async () => {
    // The security-critical invariant: a rejected verify must leave storage
    // empty. `verify()` writes the grant only AFTER `client.fetch` resolves, and
    // fetch throws on a non-2xx — so a wrong password never reaches setItem.
    stubFetch(
      jsonResponse(
        { error: { code: 'board_password_invalid', message: 'Access denied' } },
        401,
      ),
    );
    const { board, storage } = makeBoard();
    await expect(board.password.verify('wrong-horse')).rejects.toThrow();
    expect(await storage.getItem(BOARD_ACCESS_GRANT_KEY)).toBeNull();
  });

  it('subsequent reads auto-carry the X-Board-Access grant', async () => {
    const spy = stubFetch(jsonResponse(GRANT));
    const { board } = makeBoard();
    await board.password.verify('correct-horse');
    await board.seo();
    const headers = spy.mock.calls[1]![1]!.headers as Headers;
    expect(headers.get('x-board-access')).toBe('hmac-grant-hex');
  });

  it('a per-call X-Board-Access header overrides the stored grant', async () => {
    const spy = stubFetch(jsonResponse(GRANT));
    const { board } = makeBoard();
    await board.password.verify('correct-horse');
    await board.seo({ headers: { 'x-board-access': 'explicit-grant' } });
    const headers = spy.mock.calls[1]![1]!.headers as Headers;
    expect(headers.get('x-board-access')).toBe('explicit-grant');
  });

  it('sending the grant on a GET also rides x-cavuno-sdk (the request is no longer CORS-simple)', async () => {
    const spy = stubFetch(jsonResponse(GRANT));
    const { board } = makeBoard();
    await board.password.verify('correct-horse');
    await board.seo();
    const headers = spy.mock.calls[1]![1]!.headers as Headers;
    expect(headers.get('x-cavuno-sdk')).toContain('board@');
  });

  it('without a grant, a bare GET stays CORS-simple (no x-board-access, no x-cavuno-sdk)', async () => {
    const spy = stubFetch(jsonResponse(GRANT));
    const { board } = makeBoard();
    await board.seo();
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.has('x-board-access')).toBe(false);
    expect(headers.has('x-cavuno-sdk')).toBe(false);
  });
});
