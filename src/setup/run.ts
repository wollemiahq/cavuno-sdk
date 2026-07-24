import { loadSkillManifest, resolveFromPackageRoot } from '../skills';

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface SetupResult {
  version: string;
  framework: string | null;
  /** Every skill root that received the corpus. */
  targetDirs: string[];
  copied: string[];
}

/** Detect the consumer framework from its package.json dependencies. */
export function detectFramework(cwd: string): string | null {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['@tanstack/react-start']) return 'tanstack-start';
  return null;
}

/**
 * Copy the version-matched skill corpus into the consumer's skill roots:
 * `.agents/skills/` (the cross-agent convention), `.claude/skills/` (Claude
 * Code), `.codex/skills/` (Codex), and/or `.cursor/skills/` (Cursor) — every
 * root that exists, or `.agents/skills/` when none does. Copies the
 * framework-agnostic core skills plus the flavor matching the detected
 * framework. Idempotent:
 * re-running overwrites the
 * `cavuno-board-*` skills (they are version-matched artifacts) and never
 * touches other skills.
 */
export function runSetup(cwd: string = process.cwd()): SetupResult {
  const manifest = loadSkillManifest();
  const framework = detectFramework(cwd);
  const chosen = manifest.skills.filter(
    (skill) => skill.category === 'core' || skill.framework === framework,
  );
  const roots = [
    resolve(cwd, '.agents', 'skills'),
    resolve(cwd, '.claude', 'skills'),
    resolve(cwd, '.codex', 'skills'),
    resolve(cwd, '.cursor', 'skills'),
  ];
  const existing = roots.filter((root) => existsSync(root));
  const targetDirs = existing.length > 0 ? existing : [roots[0]!];
  const copied: string[] = [];
  for (const targetDir of targetDirs) {
    mkdirSync(targetDir, { recursive: true });
    for (const skill of chosen) {
      const sourceDir = dirname(resolveFromPackageRoot(skill.path));
      const destDir = resolve(targetDir, skill.name);
      mkdirSync(destDir, { recursive: true });
      cpSync(sourceDir, destDir, { recursive: true });
      if (!copied.includes(skill.name)) copied.push(skill.name);
    }
  }
  return { version: manifest.version, framework, targetDirs, copied };
}
