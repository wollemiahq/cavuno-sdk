import { describe, expect, it } from 'vitest';

import * as filtersModule from './filters';
import * as formatModule from './format';
import { createBoardClient } from './index';
import * as sdk from './index';
import * as seoModule from './seo';
import * as serverModule from './server';
import * as sitemapModule from './sitemap';
import { loadSkillCorpus } from './skills';
import * as suggestModule from './suggest';

// Drift guard (fail-loud, parity-culture): every `@cavuno/board` symbol a skill
// teaches must exist. If a future SDK change renames or removes an export or a
// namespace method, the skills that reference it fail this suite — teaching
// examples can't silently rot against the real surface. This checks symbol
// existence (exports + `board.x.y` methods), not full types; per-block type
// checking is a future release.

const board = createBoardClient({
  baseUrl: 'https://api.cavuno.com',
  board: 'pk_test',
});
const exported = new Set(Object.keys(sdk));
/** Per-subpath export sets — skills import from these entry points too. */
const SUBPATH_EXPORTS: Record<string, Set<string>> = {
  '': exported,
  '/format': new Set(Object.keys(formatModule)),
  '/filters': new Set(Object.keys(filtersModule)),
  '/suggest': new Set(Object.keys(suggestModule)),
  '/seo': new Set(Object.keys(seoModule)),
  '/sitemap': new Set(Object.keys(sitemapModule)),
  '/server': new Set(Object.keys(serverModule)),
};
const corpus = loadSkillCorpus();

function skillDocuments(skill: (typeof corpus.skills)[number]): string[] {
  return [
    skill.content,
    ...skill.references.map((reference) => reference.content),
  ];
}

/** Code blocks tagged ```ts / ```ts snippet, excluding ```ts no-check. */
function checkableBlocks(md: string): string[] {
  const blocks: string[] = [];
  const re = /```ts([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(md)) !== null) {
    const info = match[1] ?? '';
    const body = match[2];
    if (body === undefined || info.includes('no-check')) continue;
    blocks.push(body);
  }
  return blocks;
}

/** Value (non-type) names imported from '@cavuno/board' or a subpath, with the subpath. */
function importedValueNames(block: string): Array<[string, string]> {
  const names: Array<[string, string]> = [];
  const re =
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]@cavuno\/board(\/[a-z-]+)?['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    if (match[1]) continue; // `import type { ... }`
    const inner = match[2];
    if (!inner) continue;
    const subpath = match[3] ?? '';
    for (const raw of inner.split(',')) {
      const token = raw.trim();
      if (!token || token.startsWith('type ')) continue; // inline `type X`
      names.push([subpath, token.replace(/\s+as\s+\w+$/, '')]);
    }
  }
  return names;
}

/** `board.a.b.c(` call chains (generic args tolerated) → [['a','b','c'], …]. */
function boardChains(block: string): string[][] {
  const chains: string[][] = [];
  const re =
    /\bboard\.([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*(?:<[^>]*>)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    const chain = match[1];
    if (chain) chains.push(chain.split('.'));
  }
  return chains;
}

function resolveChain(root: unknown, chain: string[]): unknown {
  let current: unknown = root;
  for (const key of chain) {
    current = (current as Record<string, unknown> | undefined)?.[key];
  }
  return current;
}

describe('skill code examples reference real SDK symbols', () => {
  it('imports only exports that exist on @cavuno/board (root or subpath)', () => {
    const missing: string[] = [];
    for (const skill of corpus.skills) {
      for (const document of skillDocuments(skill)) {
        for (const block of checkableBlocks(document)) {
          for (const [subpath, name] of importedValueNames(block)) {
            const names = SUBPATH_EXPORTS[subpath];
            if (!names) {
              missing.push(
                `${skill.name}: unknown subpath @cavuno/board${subpath}`,
              );
            } else if (!names.has(name)) {
              missing.push(`${skill.name}: ${subpath || 'root'} ${name}`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('calls only board namespace methods that exist', () => {
    const broken: string[] = [];
    for (const skill of corpus.skills) {
      for (const document of skillDocuments(skill)) {
        for (const block of checkableBlocks(document)) {
          for (const chain of boardChains(block)) {
            if (typeof resolveChain(board, chain) !== 'function') {
              broken.push(`${skill.name}: board.${chain.join('.')}`);
            }
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('bites: a fabricated drift is detected', () => {
    expect(exported.has('definitelyNotExported')).toBe(false);
    expect(SUBPATH_EXPORTS['/format']!.has('formatSalaryRange')).toBe(true);
    // Presentation helpers re-exported on `/format` so client mappers avoid `/seo`.
    expect(SUBPATH_EXPORTS['/format']!.has('formatSalaryStatUsd')).toBe(true);
    expect(SUBPATH_EXPORTS['/format']!.has('formatSalaryStatRange')).toBe(true);
    expect(SUBPATH_EXPORTS['/format']!.has('normalizeWebsiteUrl')).toBe(true);
    expect(SUBPATH_EXPORTS['/format']!.has('buildJobBreadcrumbs')).toBe(true);
    expect(SUBPATH_EXPORTS['/format']!.has('definitelyNotExported')).toBe(
      false,
    );
    expect(typeof resolveChain(board, ['jobs', 'nope'])).not.toBe('function');
    // sanity: a real method still resolves, so the check is not vacuous
    expect(typeof resolveChain(board, ['jobs', 'list'])).toBe('function');
  });
});
