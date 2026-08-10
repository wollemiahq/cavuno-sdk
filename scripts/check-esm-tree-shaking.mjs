#!/usr/bin/env node

import { build } from 'esbuild';

import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');
const result = await build({
  absWorkingDir: packageRoot,
  bundle: true,
  format: 'esm',
  logLevel: 'silent',
  minify: true,
  platform: 'browser',
  stdin: {
    contents: [
      "import { jobDetailPath } from '@cavuno/board/paths';",
      "console.log(jobDetailPath('acme', 'designer'));",
    ].join('\n'),
    resolveDir: packageRoot,
    sourcefile: 'browser-esm-consumer.mjs',
  },
  treeShaking: true,
  write: false,
});

const output = result.outputFiles[0].text;
for (const unrelatedMarker of [
  'CavunoBoard',
  'createBoardClient',
  'formatSalaryRange',
  'parseListingFilters',
  'createSuggestController',
  'listingJsonLd',
]) {
  assert.equal(
    output.includes(unrelatedMarker),
    false,
    `selective ESM bundle must exclude ${unrelatedMarker}`,
  );
}
assert.match(output, /designer/);
assert.ok(
  output.length < 3_000,
  `selective paths bundle unexpectedly grew to ${output.length} bytes`,
);

console.log(`Tree-shakeable ESM fixture OK (${output.length} bytes).`);
