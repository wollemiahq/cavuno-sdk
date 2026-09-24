import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';
afterEach(() => vi.unstubAllGlobals());
describe('profile field discovery', () => {
  it('preserves discovery envelopes and encodes field paths and owner queries', async () => {
    const response = {
      data: [{ id: 'record-1', name: 'React' }],
      nextCursor: 'page:2',
    };
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const board = createBoardClient({
      baseUrl: 'https://api.cavuno.com',
      board: 'example',
    });
    expect(
      await board.profileFields.choices('company', 'tech stack', {
        search: 'React',
        cursor: 'page:1',
        limit: 5,
      }),
    ).toEqual(response);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe(
      '/v1/boards/example/profile-fields/company/tech%20stack/choices',
    );
    expect(url.searchParams.get('cursor')).toBe('page:1');
    expect(url.searchParams.get('search')).toBe('React');
    await board.profileFields.retrieve('candidate');
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(
      '/profile-fields/candidate',
    );
    await board.me.profile.listObjectReferenceChoices('private_cohort', {
      limit: 2,
    });
    const owner = new URL(String(fetcher.mock.calls[2]?.[0]));
    expect(owner.pathname).toBe(
      '/v1/boards/example/me/profile/object-references/choices',
    );
    expect(owner.searchParams.get('fieldKey')).toBe('private_cohort');
    await board.me.companies.listObjectReferenceChoices(
      'acme/team',
      'benefits',
      { search: 'Health' },
    );
    expect(String(fetcher.mock.calls[3]?.[0])).toContain(
      '/me/companies/acme%2Fteam/object-references/choices',
    );
  });
});
