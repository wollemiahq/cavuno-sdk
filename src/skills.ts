/**
 * Skill-corpus loader. Node-only (reads the shipped `skills/` directory from
 * the installed package) — kept out of the isomorphic core and exposed via the
 * `@cavuno/board/skills` subpath export. Both `npx @cavuno/board setup` and the
 * in-admin sidekick read the corpus through here, so the two doors
 * stay fed from one source.
 */
import type { SkillManifest, SkillManifestEntry } from './skills/types';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type { SkillManifest, SkillManifestEntry };

export interface LoadedSkill extends SkillManifestEntry {
  content: string;
}

export interface SkillCorpus {
  version: string;
  skills: LoadedSkill[];
}

/**
 * Package root, resolved from this module's location. Works in both source
 * (`src/skills.ts`) and built output (`dist/skills.{mjs,js}`) because both sit
 * one level under the package root. NOT valid once a bundler relocates this
 * module (e.g. Next server chunks) — bundling consumers must pass an explicit
 * `baseDir` instead.
 */
function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** Resolve a package-root-relative path (e.g. a manifest `path`) to an absolute path. */
export function resolveFromPackageRoot(
  relativePath: string,
  baseDir?: string,
): string {
  return resolve(baseDir ?? packageRoot(), relativePath);
}

export function loadSkillManifest(baseDir?: string): SkillManifest {
  const manifestPath = resolveFromPackageRoot('skills/manifest.json', baseDir);
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as SkillManifest;
}

/**
 * Load the full skill corpus — manifest metadata plus each skill's markdown
 * `content`. The sidekick injects `content` into its agent context; an external
 * Claude Code instead receives the files copied by the setup command.
 */
export function loadSkillCorpus(baseDir?: string): SkillCorpus {
  const manifest = loadSkillManifest(baseDir);
  return {
    version: manifest.version,
    skills: manifest.skills.map((skill) => ({
      ...skill,
      content: readFileSync(
        resolveFromPackageRoot(skill.path, baseDir),
        'utf8',
      ),
    })),
  };
}
