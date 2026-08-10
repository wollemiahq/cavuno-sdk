import { expect, test } from '@playwright/test';

import { resolve } from 'node:path';

const browserScript = process.env.CAVUNO_BOARD_BROWSER_SCRIPT
  ? resolve(process.env.CAVUNO_BOARD_BROWSER_SCRIPT)
  : resolve(import.meta.dirname, '../dist/browser/cavuno-board.global.min.js');

test('loads the packed classic script and uses the normal client pipeline', async ({
  page,
}) => {
  const requests = [];

  await page.route('https://static.cavuno.test/', async (route) => {
    await route.fulfill({
      body: '<!doctype html><title>Cavuno browser SDK test</title>',
      contentType: 'text/html',
    });
  });
  await page.route('https://api.cavuno.com/**', async (route) => {
    const request = route.request();
    requests.push({
      authorization: request.headers().authorization,
      url: request.url(),
    });

    const isLogin = request.url().endsWith('/auth/login');
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      json: isLogin
        ? {
            accessToken: 'access-jwt',
            refreshToken: 'refresh-token',
            boardUser: {
              email: 'browser@example.com',
              id: 'board_users_test',
              role: 'candidate',
            },
          }
        : { data: [], hasMore: false, nextCursor: null },
    });
  });

  await page.goto('https://static.cavuno.test/');
  await page.addScriptTag({ path: browserScript });

  const result = await page.evaluate(async () => {
    const sdk = globalThis.CavunoBoard;

    const memoryClient = sdk.createBoardClient({
      baseUrl: 'https://api.cavuno.com',
      board: 'pk_browser_test',
    });
    await memoryClient.jobs.list({ limit: 1 });

    const sessionClient = sdk.createBoardClient({
      auth: { storage: 'session' },
      baseUrl: 'https://api.cavuno.com',
      board: 'pk_browser_test',
    });
    await sessionClient.auth.login({
      email: 'browser@example.com',
      password: 'correct-horse-battery-staple',
    });

    const restoredSessionClient = sdk.createBoardClient({
      auth: { storage: 'session' },
      baseUrl: 'https://api.cavuno.com',
      board: 'pk_browser_test',
    });
    await restoredSessionClient.jobs.list({ limit: 2 });

    return {
      globalKeys: Object.keys(sdk),
      path: sdk.paths.jobDetailPath('acme', 'designer'),
      types: {
        client: typeof sdk.createBoardClient,
        filters: typeof sdk.filters.parseListingFilters,
        format: typeof sdk.format.formatSalaryRange,
        seo: typeof sdk.seo.listingJsonLd,
        suggest: typeof sdk.suggest.createSuggestController,
      },
      version: sdk.SDK_VERSION,
    };
  });

  expect(result.globalKeys).toEqual(
    expect.arrayContaining(['filters', 'format', 'paths', 'seo', 'suggest']),
  );
  expect(result.types).toEqual({
    client: 'function',
    filters: 'function',
    format: 'function',
    seo: 'function',
    suggest: 'function',
  });
  expect(result.path).toContain('designer');
  expect(result.version).toMatch(/^\d+\.\d+\.\d+/);

  expect(requests).toHaveLength(3);
  expect(requests[0]).toEqual({
    authorization: undefined,
    url: 'https://api.cavuno.com/v1/boards/pk_browser_test/jobs?limit=1',
  });
  expect(requests[2]).toEqual({
    authorization: 'Bearer access-jwt',
    url: 'https://api.cavuno.com/v1/boards/pk_browser_test/jobs?limit=2',
  });
});
