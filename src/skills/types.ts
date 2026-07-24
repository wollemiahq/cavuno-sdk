/**
 * Skill-manifest types, split from `skills.ts` so non-Node consumers (the
 * remote-mcp worker types its `/dev` toolset against the wire shape) can
 * import them without dragging the Node fs loader into their program.
 */

export interface SkillManifestEntry {
  name: string;
  description: string;
  /** Path to the SKILL.md, relative to the package root. */
  path: string;
  /** Framework slug for flavor skills; `null` for framework-agnostic core skills. */
  framework: string | null;
  category: 'core' | 'flavor';
}

export interface SkillManifest {
  version: string;
  skills: SkillManifestEntry[];
}
