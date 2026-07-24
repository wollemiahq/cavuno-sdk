import { describe, expect, it } from 'vitest';

import { SDK_VERSION } from './version';

import { readFileSync } from 'node:fs';

describe('SDK_VERSION', () => {
  it('matches package.json version (drift guard for the hand-written constant)', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
