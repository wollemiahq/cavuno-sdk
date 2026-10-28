import { afterEach, describe, expect, it, vi } from 'vitest';

import { isConflict, isRateLimited } from '../errors';
import { createBoardClient } from '../index';
import { resolveStorage } from '../storage';
import { PURCHASE_CONFIRMATION_HEADER } from './purchases';

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response = jsonResponse({ ok: true })) {
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

function call(spy: ReturnType<typeof stubFetch>, index = 0) {
  const [url, init] = spy.mock.calls[index]!;
  return {
    url,
    method: init?.method ?? 'GET',
    body: init?.body,
    headers: new Headers(init?.headers),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('products', () => {
  it('lists with the query', async () => {
    const spy = stubFetch();
    await makeBoard().products.list({
      price: 'free',
      sort: 'newest',
      limit: 5,
    });
    expect(call(spy).url).toBe(
      `${BASE}/products?price=free&sort=newest&limit=5`,
    );
  });

  it('gets a product and its reviews by encoded slug', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.products.get('guide/2');
    await board.products.reviews('guide', { cursor: 'c1' });
    expect(call(spy, 0).url).toBe(`${BASE}/products/guide%2F2`);
    expect(call(spy, 1).url).toBe(`${BASE}/products/guide/reviews?cursor=c1`);
  });

  it('starts a checkout and reads it back', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.products.checkout('guide', {
      email: 'ada@example.com',
      answers: [],
    });
    await board.products.getCheckout('guide', 'cs_test_1');
    expect(call(spy, 0)).toMatchObject({
      url: `${BASE}/products/guide/checkout`,
      method: 'POST',
      body: '{"email":"ada@example.com","answers":[]}',
    });
    expect(call(spy, 1).url).toBe(`${BASE}/products/guide/checkout/cs_test_1`);
  });
});

describe('purchases', () => {
  it('sends the confirmation token as a header', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.purchases.get('tok', { confirmationToken: 'conf' });
    await board.purchases.download('tok', 'file_1', {
      confirmationToken: 'conf',
    });
    await board.purchases.downloadAll('tok');
    expect(call(spy, 0).url).toBe(`${BASE}/purchases/tok`);
    expect(call(spy, 0).headers.get(PURCHASE_CONFIRMATION_HEADER)).toBe('conf');
    expect(call(spy, 1)).toMatchObject({
      url: `${BASE}/purchases/tok/files/file_1/download`,
      method: 'POST',
    });
    expect(call(spy, 1).headers.get(PURCHASE_CONFIRMATION_HEADER)).toBe('conf');
    expect(call(spy, 2)).toMatchObject({
      url: `${BASE}/purchases/tok/download-all`,
      method: 'POST',
    });
    expect(call(spy, 2).headers.get(PURCHASE_CONFIRMATION_HEADER)).toBeNull();
  });

  it('confirms the email, reviews, resends and lists the library', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.purchases.confirmEmail('tok', { email: 'ada@example.com' });
    await board.purchases.review('tok', { stars: 5 });
    await board.purchases.resend({ email: 'ada@example.com' });
    await board.purchases.mine();
    expect(call(spy, 0)).toMatchObject({
      url: `${BASE}/purchases/tok/confirm`,
      method: 'POST',
    });
    expect(call(spy, 1)).toMatchObject({
      url: `${BASE}/purchases/tok/review`,
      method: 'PUT',
      body: '{"stars":5}',
    });
    expect(call(spy, 2)).toMatchObject({
      url: `${BASE}/purchases/resend`,
      method: 'POST',
    });
    expect(call(spy, 3).url).toBe(`${BASE}/me/purchases`);
  });

  it('surfaces purchase_email_confirmation_required', async () => {
    stubFetch(
      jsonResponse(
        {
          error: {
            code: 'purchase_email_confirmation_required',
            message: 'Confirm the purchase email to open this shared link',
            requestId: 'req_1',
          },
        },
        403,
      ),
    );
    await expect(makeBoard().purchases.get('tok')).rejects.toMatchObject({
      code: 'purchase_email_confirmation_required',
      status: 403,
    });
  });

  it('reports the download cap as a conflict, not a rate limit', async () => {
    stubFetch(
      jsonResponse(
        {
          error: {
            code: 'purchase_download_limit_reached',
            message: 'The download limit for this file is reached',
            requestId: 'req_2',
          },
        },
        409,
      ),
    );
    const error: unknown = await makeBoard()
      .purchases.download('tok', 'file_1')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: 'purchase_download_limit_reached',
      status: 409,
    });
    expect(isRateLimited(error)).toBe(false);
    expect(isConflict(error)).toBe(true);
  });
});
