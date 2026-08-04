import { afterEach, describe, expect, it } from 'vitest';

import { detectFramework, runSetup } from './run';

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// Why these tests: `setup` is how an external coding agent receives the
// version-matched skills, so it must (a) land the Cavuno skills where Codex,
// Claude Code, and Cursor read them, (b) leave framework guidance to the
// framework's own installed skills, and (c) preserve developer-authored skills.

const tmpDirs: string[] = [];

function scratchProject(pkg: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'cavuno-board-setup-'));
  tmpDirs.push(dir);
  writeFileSync(
    resolve(dir, 'package.json'),
    JSON.stringify({ name: 'scratch', ...pkg }),
    'utf8',
  );
  return dir;
}

afterEach(() => {
  while (tmpDirs.length)
    rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('runSetup', () => {
  it('copies Cavuno skills into the cross-agent root', () => {
    const dir = scratchProject();
    const result = runSetup(dir);

    expect(result.framework).toBeNull();
    expect(result.copied).toContain('cavuno-board-setup');
    expect(result.copied).toContain('cavuno-board-jobs');
    expect(result.copied).not.toContain('cavuno-board-tanstack-start');
    expect(
      existsSync(resolve(dir, '.agents/skills/cavuno-board-setup/SKILL.md')),
    ).toBe(true);
  });

  //chrome copy is application-owned. setup must never seed a
  // messages/ catalog (or any other word tables) into the consumer project.
  it('does not seed a chrome-copy catalog (applications own messages/)', () => {
    const dir = scratchProject();
    runSetup(dir);
    expect(existsSync(resolve(dir, 'messages'))).toBe(false);
  });

  it('reports TanStack Start without copying framework guidance', () => {
    const dir = scratchProject({
      dependencies: { '@tanstack/react-start': '^1.0.0' },
    });
    const result = runSetup(dir);

    expect(result.framework).toBe('tanstack-start');
    expect(result.copied).not.toContain('cavuno-board-tanstack-start');
    expect(result.copied).toContain('cavuno-board-server-sessions');
  });

  it('is idempotent and never touches a developer-authored skill', () => {
    const dir = scratchProject();
    const foreign = resolve(dir, '.agents/skills/my-own-skill');
    mkdirSync(foreign, { recursive: true });
    writeFileSync(resolve(foreign, 'SKILL.md'), 'mine', 'utf8');

    runSetup(dir);
    runSetup(dir); // re-run after a notional upgrade

    expect(readFileSync(resolve(foreign, 'SKILL.md'), 'utf8')).toBe('mine');
    expect(
      existsSync(
        resolve(dir, '.agents/skills/cavuno-board-api-client/SKILL.md'),
      ),
    ).toBe(true);
  });

  it('removes retired and renamed skills from existing installations', () => {
    const dir = scratchProject();
    const retiredNames = [
      'cavuno-board-theme',
      'cavuno-board-tanstack-start',
      'cavuno-board-client',
      'cavuno-board-server',
      'cavuno-board-suggest',
      'cavuno-board-job-posting',
    ];
    for (const name of retiredNames) {
      const retired = resolve(dir, '.agents/skills', name);
      mkdirSync(retired, { recursive: true });
      writeFileSync(resolve(retired, 'SKILL.md'), 'stale', 'utf8');
    }

    const result = runSetup(dir);

    for (const name of retiredNames) {
      expect(result.copied).not.toContain(name);
      expect(existsSync(resolve(dir, '.agents/skills', name))).toBe(false);
    }
  });
});

describe('runSetup skill-dir targeting', () => {
  // Use existing agent-specific roots when present. A fresh project uses
  // `.agents/skills/`, the shared convention understood across coding agents.

  it('copies into .agents/skills when only that root exists', () => {
    const dir = scratchProject();
    mkdirSync(resolve(dir, '.agents/skills'), { recursive: true });

    const result = runSetup(dir);

    expect(result.targetDirs).toEqual([resolve(dir, '.agents/skills')]);
    expect(
      existsSync(resolve(dir, '.agents/skills/cavuno-board-setup/SKILL.md')),
    ).toBe(true);
    expect(existsSync(resolve(dir, '.claude/skills'))).toBe(false);
  });

  it('copies into .cursor/skills when only the Cursor root exists', () => {
    const dir = scratchProject();
    mkdirSync(resolve(dir, '.cursor/skills'), { recursive: true });

    const result = runSetup(dir);

    expect(result.targetDirs).toEqual([resolve(dir, '.cursor/skills')]);
    expect(
      existsSync(resolve(dir, '.cursor/skills/cavuno-board-setup/SKILL.md')),
    ).toBe(true);
    expect(existsSync(resolve(dir, '.claude/skills'))).toBe(false);
  });

  it('copies into .codex/skills when only the Codex root exists', () => {
    const dir = scratchProject();
    mkdirSync(resolve(dir, '.codex/skills'), { recursive: true });

    const result = runSetup(dir);

    expect(result.targetDirs).toEqual([resolve(dir, '.codex/skills')]);
    expect(
      existsSync(resolve(dir, '.codex/skills/cavuno-board-setup/SKILL.md')),
    ).toBe(true);
    expect(existsSync(resolve(dir, '.claude/skills'))).toBe(false);
  });

  it('copies into every recognized root when they all exist', () => {
    const dir = scratchProject();
    mkdirSync(resolve(dir, '.agents/skills'), { recursive: true });
    mkdirSync(resolve(dir, '.claude/skills'), { recursive: true });
    mkdirSync(resolve(dir, '.codex/skills'), { recursive: true });
    mkdirSync(resolve(dir, '.cursor/skills'), { recursive: true });

    const result = runSetup(dir);

    expect(result.targetDirs).toHaveLength(4);
    expect(
      existsSync(resolve(dir, '.claude/skills/cavuno-board-jobs/SKILL.md')),
    ).toBe(true);
    expect(
      existsSync(resolve(dir, '.agents/skills/cavuno-board-jobs/SKILL.md')),
    ).toBe(true);
    expect(
      existsSync(resolve(dir, '.codex/skills/cavuno-board-jobs/SKILL.md')),
    ).toBe(true);
    expect(
      existsSync(resolve(dir, '.cursor/skills/cavuno-board-jobs/SKILL.md')),
    ).toBe(true);
  });

  it('defaults to .agents/skills when no recognized root exists', () => {
    const dir = scratchProject();
    const result = runSetup(dir);
    expect(result.targetDirs).toEqual([resolve(dir, '.agents/skills')]);
  });
});

describe('detectFramework', () => {
  it('returns null when no known framework dependency is present', () => {
    const dir = scratchProject({ dependencies: { react: '^19.0.0' } });
    expect(detectFramework(dir)).toBeNull();
  });

  it('detects tanstack-start from dependencies', () => {
    const dir = scratchProject({
      devDependencies: { '@tanstack/react-start': '^1.0.0' },
    });
    expect(detectFramework(dir)).toBe('tanstack-start');
  });
});
