import { DEFAULT_CAVUNO_API_URL } from '../constants';
import { loadSkillCorpus } from '../skills';
import {
  apiBase,
  checkEnv,
  record,
  summarize,
  type CheckResult,
  type DoctorEnv,
  type DoctorSummary,
} from './checks';
import { checkCookieCodecConformance } from './cookie-conformance';
import { probe } from './probe';
import { runReadProbes, skipReadProbes, type BoardSeoSnapshot } from './read';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Public project diagnostics: static configuration checks and optional read
 * probes against the consumer's frontend. The command is intentionally
 * non-destructive and needs no Cavuno operator credentials.
 */

export interface RunDoctorOptions {
  env: DoctorEnv;
  /** The tenant's frontend base URL (`--frontend`). Read tier skips loudly without it. */
  frontendUrl?: string;
  /** Consumer project root for the skills-freshness check. Default: cwd. */
  projectRoot?: string;
  fetchImpl?: typeof fetch;
}

export interface DoctorRun {
  results: CheckResult[];
  summary: DoctorSummary;
}

const STATIC_API = record('static.api', 1);
const STATIC_BOARD = record('static.board', 1);
const STATIC_SKILLS = record('static.skills', 1);

/** : OpenAPI spec reachability on the API base. */
async function checkApiReachable(
  fetchImpl: typeof fetch,
  apiUrl: string,
): Promise<CheckResult | null> {
  try {
    new URL(apiUrl);
  } catch {
    return null; // env check already failed the malformed URL
  }
  // The spec lives at `{base}/v1/openapi.json` on every valid env —
  // api.cavuno.com serves /v1 directly, the marketing host serves it
  // behind the /api prefix that apiBase preserves. One probe, exactly
  // where the client would resolve it.
  const result = await probe(fetchImpl, `${apiBase(apiUrl)}/v1/openapi.json`);
  if (!result.ok) {
    return STATIC_API(
      'fail',
      `OpenAPI spec unreachable (HTTP ${result.status})`,
    );
  }
  // Shape check, not just HTTP 200 — captive portals and ISP filters serve
  // 200 block pages (seen live on this project's own dev network).
  try {
    const parsed = JSON.parse(result.body) as { openapi?: unknown };
    if (typeof parsed.openapi !== 'string') throw new Error('not a spec');
  } catch {
    return STATIC_API(
      'fail',
      'endpoint returned 200 but not an OpenAPI document — proxy or captive portal in the way?',
    );
  }
  return STATIC_API('pass', 'OpenAPI spec reachable');
}

/**
 *the pk_ actually resolves a board (a well-shaped key can still
 * be revoked or wrong). Probes the board CONTEXT endpoint —
 * `/v1/boards/{key}` — which serves password-protected boards too (the
 * gate itself renders from it); content endpoints like `/jobs` are gated
 * and would false-fail protected boards. The path mirrors BoardClient's
 * basePath (client.ts) — hand-built here because the client hard-codes
 * globalThis.fetch and doctor's checks run through an injected fetch.
 */
async function checkBoardResolves(
  fetchImpl: typeof fetch,
  env: DoctorEnv,
): Promise<CheckResult> {
  const result = await probe(
    fetchImpl,
    `${apiBase(env.apiUrl!)}/v1/boards/${encodeURIComponent(env.boardKey!)}`,
  );
  if (!result.ok) {
    return STATIC_BOARD(
      'fail',
      `board did not resolve for this key (HTTP ${result.status}) — revoked or wrong key?`,
    );
  }
  try {
    const parsed = JSON.parse(result.body) as unknown;
    if (typeof parsed !== 'object' || parsed === null) throw new Error('shape');
  } catch {
    return STATIC_BOARD(
      'fail',
      'board endpoint returned 200 but not JSON — proxy or captive portal in the way?',
    );
  }
  return STATIC_BOARD('pass', 'publishable key resolves the board');
}

/**
 * Dashboard SEO snapshot for tier-2 file probes. Same key-in-path fetch as
 * checkBoardResolves — GET /v1/boards/:key/seo is anonymous. Parse failure
 * (or a non-200) returns null so the file probes skip loudly.
 */
async function fetchBoardSeo(
  fetchImpl: typeof fetch,
  env: DoctorEnv,
): Promise<BoardSeoSnapshot | null> {
  const result = await probe(
    fetchImpl,
    `${apiBase(env.apiUrl!)}/v1/boards/${encodeURIComponent(env.boardKey!)}/seo`,
  );
  if (!result.ok) return null;
  try {
    const parsed = JSON.parse(result.body) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.canonicalBase !== 'string') return null;
    const asNullableString = (value: unknown): string | null =>
      value === null || typeof value === 'string' ? value : null;
    return {
      canonicalBase: rec.canonicalBase,
      adsTxt: asNullableString(rec.adsTxt),
      indexNowKey: asNullableString(rec.indexNowKey),
      googleSiteVerification: asNullableString(rec.googleSiteVerification),
    };
  } catch {
    return null;
  }
}

const SKILL_ROOTS = [
  '.claude/skills',
  '.agents/skills',
  '.cursor/skills',
] as const;

/**
 *copied skills match the installed package's corpus. `setup`
 * copies version-matched SKILL.md files into the project; after an
 * upgrade they silently go stale until setup is re-run.
 */
function checkSkillsFreshness(projectRoot: string): CheckResult {
  const roots = SKILL_ROOTS.map((root) => join(projectRoot, root)).filter(
    (root) => existsSync(root),
  );
  if (roots.length === 0) {
    return STATIC_SKILLS(
      'skip',
      'no .claude/skills, .agents/skills, or .cursor/skills directory — run `npx @cavuno/board setup` to install agent skills',
    );
  }

  const corpus = loadSkillCorpus();
  const stale = new Set<string>();
  const seen = new Set<string>();
  for (const root of roots) {
    for (const skill of corpus.skills) {
      const copied = join(root, skill.name, 'SKILL.md');
      if (!existsSync(copied)) continue;
      seen.add(skill.name);
      if (readFileSync(copied, 'utf8') !== skill.content) {
        stale.add(skill.name);
      }
    }
  }
  const found = seen.size;

  if (found === 0) {
    return STATIC_SKILLS(
      'skip',
      'no cavuno-board-* skills installed — run `npx @cavuno/board setup`',
    );
  }
  return stale.size === 0
    ? STATIC_SKILLS(
        'pass',
        `${found} installed skills match v${corpus.version}`,
      )
    : STATIC_SKILLS(
        'fail',
        `stale skills (re-run \`npx @cavuno/board setup\`): ${[...stale].join(', ')}`,
      );
}

export async function runDoctor(options: RunDoctorOptions): Promise<DoctorRun> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = {
    ...options.env,
    apiUrl: options.env.apiUrl ?? DEFAULT_CAVUNO_API_URL,
  };
  const results: CheckResult[] = [];

  // ── : static ────────────────────────────────────────────────────
  const envResults = checkEnv(env);
  results.push(...envResults);

  // Every tier-1 check appears in the results — blocked checks SKIP
  // loudly rather than silently vanishing from the report.
  const envOk = envResults.every((r) => r.status === 'pass');
  if (env.apiUrl) {
    const api = await checkApiReachable(fetchImpl, env.apiUrl);
    results.push(
      api ?? STATIC_API('skip', 'API URL malformed — fix env.api-url first'),
    );
  } else {
    results.push(STATIC_API('skip', 'PUBLIC_CAVUNO_API_URL not set'));
  }
  let seo: BoardSeoSnapshot | null = null;
  if (envOk) {
    const boardResult = await checkBoardResolves(fetchImpl, env);
    results.push(boardResult);
    if (boardResult.status === 'pass') {
      seo = await fetchBoardSeo(fetchImpl, env);
    }
  } else {
    results.push(STATIC_BOARD('skip', 'env checks failed — fix them first'));
  }
  results.push(checkSkillsFreshness(options.projectRoot ?? process.cwd()));
  // starter code sets cookies only
  // through the SDK server cookie codec (accountability, not a boundary).
  results.push(
    ...checkCookieCodecConformance(options.projectRoot ?? process.cwd()),
  );

  // ── : read probes against the tenant's frontend ────────────────
  results.push(
    ...(options.frontendUrl
      ? await runReadProbes(fetchImpl, options.frontendUrl, seo)
      : skipReadProbes('no --frontend <url> given')),
  );

  return { results, summary: summarize(results) };
}
