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

const pollIntervalMs = 10_000;

// UNPKG resolves a version from the npm registry's package document and keeps
// that document in its own cache for the registry's `max-age` (300 s). Asking
// UNPKG for the new version before the registry serves a document that lists
// it makes UNPKG cache the pre-publish document, and it then answers "Package
// version not found" for a full `max-age` however often we retry. So wait
// until the registry lists the version, then give UNPKG one cache lifetime to
// drop any copy it fetched before that.
async function waitForRegistry() {
  // Same URL and Accept header UNPKG uses, deliberately not cache-busted: we
  // want what the registry's edge serves to downstream CDNs.
  const url = `https://registry.npmjs.org/${manifest.name}`;
  // Listing took ~76 s after publish in practice. Five minutes here plus the
  // CDN phase (max-age + 60 s) keeps the step well inside the job timeout.
  const deadline = Date.now() + 5 * 60_000;
  console.log(`Waiting for the npm registry to list ${manifest.version}...`);
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const document = await response.json();
      if (document.versions?.[manifest.version]) {
        const maxAge = /max-age=(\d+)/.exec(
          response.headers.get('cache-control') ?? '',
        )?.[1];
        return Number(maxAge ?? 300) * 1000;
      }
      lastError = new Error(`${manifest.version} not listed yet`);
    } catch (error) {
      lastError = error;
    }
    await wait(pollIntervalMs);
  }
  throw new Error(`npm registry never listed ${manifest.version}: ${url}`, {
    cause: lastError,
  });
}

async function fetchPublished(url, deadline) {
  let lastError;
  for (;;) {
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
      if (Date.now() + pollIntervalMs >= deadline) break;
      await wait(pollIntervalMs);
    }
  }
  throw new Error(`CDN did not become ready: ${url}`, { cause: lastError });
}

const registryCacheMs = await waitForRegistry();
const cdnDeadline = Date.now() + registryCacheMs + 60_000;
console.log(
  `Registry lists ${manifest.version}; polling CDNs for up to ${Math.round((cdnDeadline - Date.now()) / 1000)} s...`,
);
const published = await Promise.all(
  urls.map((url) => fetchPublished(url, cdnDeadline)),
);
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
