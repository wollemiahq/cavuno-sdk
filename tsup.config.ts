import { defineConfig } from 'tsup';

const isomorphicEntries = {
  index: 'src/index.ts',
  format: 'src/format/index.ts',
  filters: 'src/filters/index.ts',
  suggest: 'src/suggest/index.ts',
  seo: 'src/seo/index.ts',
  sitemap: 'src/sitemap/index.ts',
  paths: 'src/paths/index.ts',
  go: 'src/go/index.ts',
  'route-contract': 'src/route-contract/index.ts',
  'well-known': 'src/well-known/index.ts',
  analytics: 'src/analytics/index.ts',
  'seo-files': 'src/seo-files/index.ts',
  server: 'src/server/index.ts',
} as const;

export default defineConfig([
  // Isomorphic core + helper subpaths — platform-neutral, dual
  // ESM+CJS, zero deps. Each helper is its own entry so consumers (and
  // bundlers) pull only the domain they import.
  //
  // ESM and CJS are separate tsup configs so splitting applies to ESM only.
  // tsup v8 still emits CJS chunks when `splitting: true` is set on a dual
  // format build; CJS consumers must keep the previous single-file shape.
  {
    entry: isomorphicEntries,
    format: ['esm'],
    dts: true,
    platform: 'neutral',
    outDir: 'dist',
    clean: false,
    // Shared modules (e.g. salary formatters re-exported from both `format`
    // and `seo`) become separate chunks so a selective import of
    // `formatSalaryStatRange` does not pull the job-posting country catalog.
    splitting: true,
    sourcemap: false,
    minify: false,
  },
  {
    entry: isomorphicEntries,
    format: ['cjs'],
    // Emit `.d.ts` for the require condition in package exports; the ESM
    // config above emits `.d.mts`. Both are required by the dual export map.
    dts: true,
    platform: 'neutral',
    outDir: 'dist',
    clean: false,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
  // Browser-global build for classic <script> consumers. This is a separate,
  // self-contained artifact: npm consumers continue to use the tree-shakeable
  // ESM entries above, while static HTML gets one stable CavunoBoard global.
  {
    entry: {
      'browser/cavuno-board.global.min': 'src/browser-global.ts',
    },
    format: ['iife'],
    globalName: 'CavunoBoard',
    platform: 'browser',
    target: 'es2020',
    outDir: 'dist',
    // tsup otherwise appends `.global.js` for IIFE output. The published CDN
    // URL is an explicit, stable `.js` path.
    outExtension: () => ({ js: '.js' }),
    clean: false,
    splitting: false,
    dts: false,
    sourcemap: false,
    minify: true,
  },
  // Types-only manifest shapes for the `./skills/types` subpath export —
  // isomorphic, no imports at all. A dedicated subpath is deliberate: the
  // remote-mcp worker's tsc program cannot type-check either `./skills`
  // (drags `node:fs` types into a Workers program) or the package root
  // (drags the core graph incl. DOM `Storage` in storage.ts) — `import
  // type` erasure is a runtime property, not a type-check one.
  {
    entry: { 'skills-types': 'src/skills/types.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    platform: 'neutral',
    outDir: 'dist',
    clean: false,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
  // Node-only skill-corpus loader for the `./skills` subpath export.
  // `shims: true` gives the CJS output a real `import.meta.url`
  // (esbuild otherwise stubs it to `{}`, breaking the require() path).
  {
    entry: { skills: 'src/skills.ts' },
    format: ['esm', 'cjs'],
    dts: { resolve: true },
    tsconfig: './tsconfig.node.json',
    platform: 'node',
    target: 'node20',
    outDir: 'dist',
    clean: false,
    shims: true,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
  // Node-only programmatic doctor surface (`./doctor`) — 's
  // verification port wraps runDoctor for structured results.
  {
    entry: { doctor: 'src/doctor/index.ts' },
    format: ['esm', 'cjs'],
    dts: { resolve: true },
    tsconfig: './tsconfig.node.json',
    platform: 'node',
    target: 'node20',
    outDir: 'dist',
    clean: false,
    shims: true,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
  // Node-only `setup` CLI bin (ESM, executable shebang).
  {
    entry: { bin: 'src/bin.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    clean: false,
    splitting: false,
    sourcemap: false,
    minify: false,
  },
]);
