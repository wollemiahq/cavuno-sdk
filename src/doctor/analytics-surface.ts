/**
 *forbid Tinybird-branded analytics APIs in starter app source.
 * Cavuno Analytics uses `@cavuno/board/analytics` + `CAVUNO_BOARD` only.
 */

import { record, type CheckResult } from './checks';

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ANALYTICS = record('static.analytics-surface', 1);

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|astro|svelte|vue|mdx)$/;
const TEST_FILE = /\.(?:test|spec)\./;

const FORBIDDEN: { id: string; re: RegExp }[] = [
  { id: 'window.Tinybird', re: /\bwindow\.Tinybird\b/ },
  { id: '@tinybirdco/flock', re: /@tinybirdco\/flock/ },
  { id: 'CAVUNO_TRACKER_TOKEN', re: /\bCAVUNO_TRACKER_TOKEN\b/ },
];

const SCAN_ROOTS = ['src', 'app', 'apps'] as const;
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  'paraglide',
]);

function walkFiles(root: string, out: string[]): void {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (SOURCE_EXT.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full);
    }
  }
}

export function checkAnalyticsSurface(projectRoot: string): CheckResult {
  const files: string[] = [];
  for (const name of SCAN_ROOTS) {
    walkFiles(join(projectRoot, name), files);
  }

  if (files.length === 0) {
    return ANALYTICS(
      'skip',
      'no src/, app/, or apps/ tree to scan for analytics surface',
    );
  }

  const hits: string[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const rule of FORBIDDEN) {
      if (rule.re.test(text)) {
        hits.push(`${relative(projectRoot, file)}:${rule.id}`);
      }
    }
  }

  if (hits.length === 0) {
    return ANALYTICS(
      'pass',
      'no Tinybird-branded analytics APIs in app source',
    );
  }

  return ANALYTICS(
    'fail',
    `use @cavuno/board/analytics + CAVUNO_BOARD only — found ${hits.slice(0, 8).join(', ')}${hits.length > 8 ? ` (+${hits.length - 8} more)` : ''}`,
  );
}
