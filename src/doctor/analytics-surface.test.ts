import { describe, expect, it } from 'vitest';

import { checkAnalyticsSurface } from './analytics-surface';

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('checkAnalyticsSurface', () => {
  it('passes when src has no forbidden analytics APIs', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-ok-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src', 'boot.ts'),
      "import { analytics } from '@cavuno/board/analytics';\n",
    );

    const result = checkAnalyticsSurface(root);
    expect(result.status).toBe('pass');
    expect(result.id).toBe('static.analytics-surface');
  });

  it.each([
    ['src', 'window.Tinybird'],
    ['app', '@tinybirdco/flock'],
    ['apps/board/src', 'CAVUNO_TRACKER_TOKEN'],
  ])('fails on %s source containing %s', (sourceDir, forbidden) => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-tb-'));
    mkdirSync(join(root, sourceDir), { recursive: true });
    writeFileSync(
      join(root, sourceDir, 'track.ts'),
      `export const legacy = ${JSON.stringify(forbidden)};\n`,
    );

    const result = checkAnalyticsSurface(root);
    expect(result.status).toBe('fail');
    expect(result.detail).toContain(forbidden);
  });

  it.each(['node_modules', 'dist', '.git'])(
    'skips %s directories',
    (skippedDir) => {
      const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-skip-'));
      const sourceDir = join(root, 'src', skippedDir);
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(
        join(sourceDir, 'legacy.ts'),
        'window.Tinybird?.trackEvent("job_apply_click");\n',
      );
      writeFileSync(join(root, 'src', 'app.ts'), 'export const app = true;\n');

      expect(checkAnalyticsSurface(root).status).toBe('pass');
    },
  );

  it('reports the source path for a failure', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-path-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src', 'track.ts'),
      'window.Tinybird?.trackEvent("job_apply_click");\n',
    );

    expect(checkAnalyticsSurface(root).detail).toContain(
      'src/track.ts:window.Tinybird',
    );
  });

  it('skips when no scan roots exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-empty-'));
    const result = checkAnalyticsSurface(root);
    expect(result.status).toBe('skip');
  });

  it('ignores forbidden strings in *.test.* files', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-tests-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src', 'analytics-surface.test.ts'),
      'window.Tinybird?.trackEvent("job_apply_click");\n',
    );
    writeFileSync(join(root, 'src', 'boot.ts'), 'export const ok = true;\n');

    expect(checkAnalyticsSurface(root).status).toBe('pass');
  });
});
