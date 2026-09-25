import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

afterEach(() => vi.unstubAllGlobals());

describe('board.locations.resolve', () => {
  it('POSTs the picked id and provider session and returns the location', async () => {
    const location = {
      object: 'location',
      id: 'place-1',
      name: 'Berlin',
      fullName: 'Berlin, Germany',
      contextLabel: 'Germany',
      placeType: 'city',
      countryCode: 'DE',
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(location), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const board = createBoardClient({
      baseUrl: 'https://api.cavuno.com',
      board: 'acme',
    });

    await expect(
      board.locations.resolve({
        locationId: 'place-1',
        session: 'picker-session',
      }),
    ).resolves.toEqual(location);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://api.cavuno.com/v1/boards/acme/locations/resolve',
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        locationId: 'place-1',
        session: 'picker-session',
      }),
    });
  });
});
