import { describe, expect, it } from 'vitest';

import { checkThemeFreshness } from './theme';

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Local derivation freshness: tokens.css must match the generated resolved
 * theme module. Projects that do not use this optional layout skip cleanly.
 */

const TOKENS = ':root {\n  --background: #fff;\n}\n';
const HASH = createHash('sha256').update(TOKENS, 'utf8').digest('hex');

function project({
  tokens,
  resolvedHash,
}: {
  tokens?: string;
  resolvedHash?: string;
}): string {
  const root = mkdtempSync(join(tmpdir(), 'doctor-theme-'));
  if (tokens !== undefined) {
    mkdirSync(join(root, 'src/theme'), { recursive: true });
    writeFileSync(join(root, 'src/tokens.css'), tokens);
    if (resolvedHash !== undefined) {
      writeFileSync(
        join(root, 'src/theme/resolved.ts'),
        `export const tokensHash = '${resolvedHash}'\n`,
      );
    }
  }
  return root;
}

describe('checkThemeFreshness', () => {
  it('loud-skips a project without src/tokens.css', () => {
    const [result] = checkThemeFreshness(project({}));
    expect(result!.status).toBe('skip');
    expect(result!.detail).toMatch(/tokens\.css/i);
  });

  it('passes when tokens.css matches the resolved module', () => {
    const root = project({ tokens: TOKENS, resolvedHash: HASH });
    const [result] = checkThemeFreshness(root);
    expect(result!.status).toBe('pass');
  });

  it('fails on a stale resolved module, naming gen:theme', () => {
    const root = project({ tokens: TOKENS, resolvedHash: 'f'.repeat(64) });
    const [result] = checkThemeFreshness(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/gen:theme/);
  });

  it('fails when the resolved module is missing entirely', () => {
    const root = project({ tokens: TOKENS });
    const [result] = checkThemeFreshness(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/gen:theme/);
  });
});
