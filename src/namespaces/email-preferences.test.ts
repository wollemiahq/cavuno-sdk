import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';
const TOKEN = 'bu_1.' + 'a'.repeat(64);

function stubFetch() {
  const spy = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ object: 'email_preferences' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const board = () =>
  createBoardClient({ baseUrl: 'https://api.cavuno.com', board: 'acme-jobs' });

const call = (spy: ReturnType<typeof stubFetch>) => ({
  url: spy.mock.calls[0]![0],
  init: spy.mock.calls[0]![1]!,
  headers: new Headers(spy.mock.calls[0]![1]!.headers),
});

afterEach(() => vi.unstubAllGlobals());

describe('board.emailPreferences', () => {
  it('get sends the token in its header, never in the URL, and keeps the caller headers', async () => {
    const spy = stubFetch();
    await board().emailPreferences.get(TOKEN, {
      headers: { 'x-request-source': 'page' },
    });
    const { url, headers } = call(spy);
    expect(url).toBe(`${BASE}/email-preferences`);
    expect(url).not.toContain(TOKEN);
    expect(headers.get('x-email-preferences-token')).toBe(TOKEN);
    expect(headers.get('x-request-source')).toBe('page');
  });

  it('update PATCHes the changes with the token header', async () => {
    const spy = stubFetch();
    await board().emailPreferences.update(TOKEN, {
      marketing: true,
      consentText: 'Send me news and offers from Acme Jobs.',
    });
    const { url, init, headers } = call(spy);
    expect(url).toBe(`${BASE}/email-preferences`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      marketing: true,
      consentText: 'Send me news and offers from Acme Jobs.',
    });
    expect(headers.get('x-email-preferences-token')).toBe(TOKEN);
  });

  it('unsubscribeAll POSTs to unsubscribe-all with the token header', async () => {
    const spy = stubFetch();
    await board().emailPreferences.unsubscribeAll(TOKEN);
    const { url, init, headers } = call(spy);
    expect(url).toBe(`${BASE}/email-preferences/unsubscribe-all`);
    expect(init.method).toBe('POST');
    expect(headers.get('x-email-preferences-token')).toBe(TOKEN);
  });
});
