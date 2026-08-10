#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

const packageRoot = resolve(import.meta.dirname, '..');
const browserPath = resolve(
  packageRoot,
  'dist/browser/cavuno-board.global.min.js',
);
const browserSource = await readFile(browserPath, 'utf8');

assert.equal(
  browserSource.includes('sourceMappingURL='),
  false,
  'browser-global build must not publish a source map reference',
);
assert.equal(
  /\brequire\s*\(/.test(browserSource),
  false,
  'browser-global build must not contain CommonJS require calls',
);
assert.equal(
  /(?:^|[;{}])\s*import\s/.test(browserSource),
  false,
  'browser-global build must be self-contained',
);
assert.equal(
  browserSource.includes('node:'),
  false,
  'browser-global build must not reference Node built-ins',
);

const requests = [];
const sessionBacking = new Map();
const storage = {
  getItem(key) {
    return sessionBacking.get(key) ?? null;
  },
  setItem(key, value) {
    sessionBacking.set(key, String(value));
  },
  removeItem(key) {
    sessionBacking.delete(key);
  },
};

const context = {
  AbortController,
  ArrayBuffer,
  Blob,
  DOMException,
  FormData,
  Headers,
  Map,
  Promise,
  ReadableStream,
  Response,
  Set,
  URL,
  URLSearchParams,
  clearTimeout,
  console,
  document: {},
  fetch: async (url, init) => {
    requests.push({ url: String(url), init });

    if (String(url).endsWith('/auth/login')) {
      return Response.json({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-token',
        boardUser: {
          id: 'board_users_test',
          email: 'browser@example.com',
          role: 'candidate',
        },
      });
    }

    return Response.json({
      data: [],
      hasMore: false,
      nextCursor: null,
    });
  },
  localStorage: storage,
  sessionStorage: storage,
  setTimeout,
};
const originalContextKeys = new Set(Object.keys(context));

runInNewContext(browserSource, context, {
  filename: 'cavuno-board.global.min.js',
});

const browserGlobal = context.CavunoBoard;
assert.ok(browserGlobal, 'classic script must install globalThis.CavunoBoard');
assert.deepEqual(
  Object.keys(context).filter((key) => !originalContextKeys.has(key)),
  ['CavunoBoard'],
  'classic script must install only the documented CavunoBoard global',
);

const helperEntries = {
  filters: 'filters.mjs',
  format: 'format.mjs',
  paths: 'paths.mjs',
  seo: 'seo.mjs',
  suggest: 'suggest.mjs',
};
const helperNames = Object.keys(helperEntries).sort();
const rootModule = await import(
  pathToFileURL(resolve(packageRoot, 'dist/index.mjs')).href
);

assert.deepEqual(
  Object.keys(browserGlobal).sort(),
  [...Object.keys(rootModule), ...helperNames].sort(),
  'CavunoBoard must mirror the root runtime exports plus helper namespaces',
);
assert.equal(
  Object.hasOwn(browserGlobal, 'helpers'),
  false,
  'helper namespaces must not be nested under CavunoBoard.helpers',
);

for (const [namespace, entry] of Object.entries(helperEntries)) {
  const helperModule = await import(
    pathToFileURL(resolve(packageRoot, 'dist', entry)).href
  );
  assert.deepEqual(
    Object.keys(browserGlobal[namespace]).sort(),
    Object.keys(helperModule).sort(),
    `CavunoBoard.${namespace} must mirror @cavuno/board/${namespace}`,
  );
}

assert.equal(typeof browserGlobal.createBoardClient, 'function');
assert.equal(typeof browserGlobal.format.formatSalaryRange, 'function');
assert.equal(typeof browserGlobal.filters.parseListingFilters, 'function');
assert.equal(typeof browserGlobal.suggest.createSuggestController, 'function');
assert.equal(typeof browserGlobal.paths.jobDetailPath, 'function');

const board = browserGlobal.createBoardClient({
  baseUrl: 'https://api.cavuno.com',
  board: 'pk_browser_test',
  auth: { storage: 'session' },
});
await board.auth.login({
  email: 'browser@example.com',
  password: 'correct-horse-battery-staple',
});
await board.jobs.list({ limit: 1 });

assert.equal(requests.length, 2);
assert.equal(
  requests[1].url,
  'https://api.cavuno.com/v1/boards/pk_browser_test/jobs?limit=1',
);
assert.equal(
  new Headers(requests[1].init.headers).get('authorization'),
  'Bearer access-jwt',
  'persistent browser storage must feed the normal bearer pipeline',
);

const bytes = Buffer.byteLength(browserSource);
const gzipBytes = gzipSync(browserSource).byteLength;
const integrity = `sha384-${createHash('sha384')
  .update(browserSource)
  .digest('base64')}`;

console.log(
  `Browser-global build OK (${bytes} bytes, ${gzipBytes} gzip, ${integrity})`,
);
