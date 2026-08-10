#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const packageRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
);
const artifact = await readFile(
  resolve(packageRoot, 'dist/browser/cavuno-board.global.min.js'),
);
const path = 'dist/browser/cavuno-board.global.min.js';
const urls = [
  `https://cdn.jsdelivr.net/npm/@cavuno/board@${manifest.version}/${path}`,
  `https://cdn.jsdelivr.net/npm/@cavuno/board@${manifest.version}`,
  `https://unpkg.com/@cavuno/board@${manifest.version}/${path}`,
  `https://unpkg.com/@cavuno/board@${manifest.version}`,
];

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function fetchPublished(url) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type') ?? '';
      assert.match(contentType, /javascript|ecmascript/i, `${url} MIME type`);
      assert.equal(
        response.headers.get('access-control-allow-origin'),
        '*',
        `${url} must permit cross-origin script loading`,
      );
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 12) await wait(10_000);
    }
  }
  throw new Error(`CDN did not become ready: ${url}`, { cause: lastError });
}

const published = await Promise.all(urls.map(fetchPublished));
for (const [index, bytes] of published.entries()) {
  assert.deepEqual(
    bytes,
    artifact,
    `${urls[index]} bytes differ from npm build`,
  );
}
const context = {
  AbortController,
  ArrayBuffer,
  Blob,
  DOMException,
  FormData,
  Headers,
  Promise,
  ReadableStream,
  Response,
  URL,
  URLSearchParams,
  clearTimeout,
  console,
  document: {},
  fetch,
  setTimeout,
};
runInNewContext(published[0].toString('utf8'), context, {
  filename: 'cavuno-board.global.min.js',
});
assert.equal(typeof context.CavunoBoard?.createBoardClient, 'function');
assert.equal(context.CavunoBoard?.SDK_VERSION, manifest.version);
for (const namespace of ['filters', 'format', 'paths', 'seo', 'suggest']) {
  assert.equal(
    typeof context.CavunoBoard?.[namespace],
    'object',
    `CDN global missing CavunoBoard.${namespace}`,
  );
}

const integrity = `sha384-${createHash('sha384')
  .update(artifact)
  .digest('base64')}`;
console.log(
  `Verified @cavuno/board@${manifest.version} explicit and package-entry URLs on jsDelivr and UNPKG (${artifact.byteLength} bytes, ${integrity}).`,
);
