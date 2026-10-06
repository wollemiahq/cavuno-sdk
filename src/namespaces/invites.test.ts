import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';
import { resolveStorage } from '../storage';

const PREVIEW = {
  object: 'company_member_invite_preview',
  status: 'pending',
  email: 'ada@acme.test',
  expiresAt: '2026-10-13T12:00:00.000Z',
  account: 'none',
  company: { slug: 'acme', name: 'Acme', logoUrl: null },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    response.clone(),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function makeBoard() {
  return createBoardClient({
    baseUrl: 'https://api.cavuno.com',
    board: 'acme-jobs',
    auth: { storage: resolveStorage('memory') },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('invites.preview', () => {
  it('POSTs the token in the body to /invites/preview and returns the preview', async () => {
    const spy = stubFetch(jsonResponse(PREVIEW));
    const preview = await makeBoard().invites.preview({ token: 'tok' });
    expect(spy.mock.calls[0]![0]).toBe(
      'https://api.cavuno.com/v1/boards/acme-jobs/invites/preview',
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"tok"}');
    expect(preview).toEqual(PREVIEW);
  });

  it('throws employer_invite_not_found for an unknown token', async () => {
    stubFetch(
      jsonResponse(
        {
          error: {
            code: 'employer_invite_not_found',
            message: 'Company member invite not found',
          },
        },
        404,
      ),
    );
    await expect(
      makeBoard().invites.preview({ token: 'nope' }),
    ).rejects.toMatchObject({ code: 'employer_invite_not_found', status: 404 });
  });
});
