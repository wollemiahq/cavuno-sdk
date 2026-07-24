import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generates skills/manifest.json from the SKILL.md frontmatter — the same
// generate-and-commit pattern as packages/cli/scripts/generate-manifest.ts.
// The manifest is the enumeration contract both the setup CLI and the sidekick
// read, and its `version` is kept in lockstep with the package version.

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const skillsDir = resolve(pkgRoot, 'skills');
const pkg = JSON.parse(
  readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'),
) as { version: string };

function findSkillFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findSkillFiles(full));
    else if (entry === 'SKILL.md') out.push(full);
  }
  return out;
}

function parseFrontmatter(md: string): { name: string; description: string } {
  const block = md.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!block) throw new Error('SKILL.md is missing YAML frontmatter');
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) {
    throw new Error('SKILL.md frontmatter must set `name` and `description`');
  }
  return { name, description };
}

const skills = findSkillFiles(skillsDir)
  .map((file) => {
    const rel = relative(pkgRoot, file).split(/[\\/]/).join('/');
    const { name, description } = parseFrontmatter(readFileSync(file, 'utf8'));
    const flavor = rel.match(/^skills\/flavors\/([^/]+)\//);
    return {
      name,
      description,
      path: rel,
      framework: flavor ? flavor[1] : null,
      category: flavor ? ('flavor' as const) : ('core' as const),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const manifest = { version: pkg.version, skills };
const outPath = resolve(skillsDir, 'manifest.json');
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Wrote ${skills.length} skills → ${outPath}`);
