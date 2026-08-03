import { describe, expect, it } from 'vitest';

import {
  bundleSkillMarkdown,
  loadSkillCorpus,
  loadSkillManifest,
} from './skills';

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The loader's default package-root resolution comes from `import.meta.url`,
 * which is wrong once a bundler (Next) relocates the module — so consumers
 * that bundle pass an explicit `baseDir`.
 * These tests pin the `baseDir` contract against a synthetic corpus.
 */
function writeCorpus(): string {
  const root = mkdtempSync(join(tmpdir(), 'skills-corpus-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '9.9.9' }),
  );
  const skillsDir = join(root, 'skills', 'cavuno-board-demo');
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(
    join(skillsDir, 'SKILL.md'),
    '---\nname: cavuno-board-demo\ndescription: Demo skill.\n---\n\nBody text.\n',
  );
  writeFileSync(join(skillsDir, 'DETAILS.md'), '# Disclosed details\n');
  writeFileSync(
    join(root, 'skills', 'manifest.json'),
    JSON.stringify({
      version: '9.9.9',
      skills: [
        {
          name: 'cavuno-board-demo',
          description: 'Demo skill.',
          path: 'skills/cavuno-board-demo/SKILL.md',
          framework: null,
          category: 'core',
        },
      ],
    }),
  );
  return root;
}

describe('skills loader baseDir', () => {
  it('loadSkillManifest reads the manifest under an explicit baseDir', () => {
    const root = writeCorpus();
    const manifest = loadSkillManifest(root);
    expect(manifest.version).toBe('9.9.9');
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.skills[0]!.name).toBe('cavuno-board-demo');
  });

  it('loadSkillCorpus resolves skill content relative to baseDir', () => {
    const root = writeCorpus();
    const corpus = loadSkillCorpus(root);
    expect(corpus.skills[0]!.content).toContain('Body text.');
    expect(corpus.skills[0]!.references).toEqual([
      {
        path: 'DETAILS.md',
        content: '# Disclosed details\n',
      },
    ]);
    expect(bundleSkillMarkdown(corpus.skills[0]!)).toContain(
      'Disclosed reference: DETAILS.md',
    );
  });

  it('default (no baseDir) still reads the real shipped corpus', () => {
    const manifest = loadSkillManifest();
    expect(manifest.skills.length).toBeGreaterThan(10);
    expect(manifest.skills.every((s) => s.path.startsWith('skills/'))).toBe(
      true,
    );
  });
});
