/**
 * Skill-corpus loader. Node-only (reads the shipped `skills/` directory from
 * the installed package) — kept out of the isomorphic core and exposed via the
 * `@cavuno/board/skills` subpath export. Both `npx @cavuno/board setup` and the
 * in-admin sidekick read the corpus through here, so the two doors
 * stay fed from one source.
 */
import type { SkillManifest, SkillManifestEntry } from './skills/types';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type { SkillManifest, SkillManifestEntry };

export interface LoadedSkill extends SkillManifestEntry {
  content: string;
  references: LoadedSkillReference[];
}

export interface LoadedSkillReference {
  /** Filename relative to the skill's directory. */
  path: string;
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
 * Load the full skill corpus — manifest metadata, each SKILL.md, and its
 * disclosed Markdown references. Filesystem consumers keep the references
 * separate; transports without sibling-file access use `bundleSkillMarkdown`.
 */
export function loadSkillCorpus(baseDir?: string): SkillCorpus {
  const manifest = loadSkillManifest(baseDir);
  return {
    version: manifest.version,
    skills: manifest.skills.map((skill) => {
      const skillPath = resolveFromPackageRoot(skill.path, baseDir);
      const skillDir = dirname(skillPath);
      const references = readdirSync(skillDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name !== 'SKILL.md' &&
            entry.name.endsWith('.md'),
        )
        .map((entry) => ({
          path: entry.name,
          content: readFileSync(resolve(skillDir, entry.name), 'utf8'),
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

      return {
        ...skill,
        content: readFileSync(skillPath, 'utf8'),
        references,
      };
    }),
  };
}

/**
 * Flatten one skill for transports that cannot resolve sibling files. Local
 * setup keeps the files separate so agents retain progressive disclosure.
 */
export function bundleSkillMarkdown(skill: LoadedSkill): string {
  const references = skill.references
    .map(
      (reference) =>
        `## Disclosed reference: ${reference.path}\n\n${reference.content.trim()}`,
    )
    .join('\n\n---\n\n');

  return references
    ? `${skill.content.trim()}\n\n---\n\n${references}\n`
    : skill.content;
}
