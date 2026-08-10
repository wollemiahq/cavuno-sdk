#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');
const work = mkdtempSync(join(tmpdir(), 'cavuno-board-browser-test-'));
const tarballs = join(work, 'tarballs');
const extracted = join(work, 'extracted');
mkdirSync(tarballs, { recursive: true });
mkdirSync(extracted, { recursive: true });

try {
  const raw = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', tarballs],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: join(work, 'npm-cache'),
        npm_config_logs_dir: join(work, 'npm-logs'),
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const [pack] = JSON.parse(raw);
  if (!pack?.filename) throw new Error('npm pack returned no filename');

  execFileSync(
    'tar',
    ['-xzf', join(tarballs, pack.filename), '-C', extracted],
    { stdio: 'inherit' },
  );

  execFileSync(
    'pnpm',
    ['exec', 'playwright', 'test', '-c', 'playwright.browser.config.mjs'],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        CAVUNO_BOARD_BROWSER_SCRIPT: join(
          extracted,
          'package/dist/browser/cavuno-board.global.min.js',
        ),
      },
      stdio: 'inherit',
    },
  );
} finally {
  rmSync(work, { force: true, recursive: true });
}
