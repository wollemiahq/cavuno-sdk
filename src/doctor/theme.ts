import { record, type CheckResult } from './checks';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 *theme derivation-freshness. For a
 * tokens-migrated board the repo's `src/tokens.css` is the canonical
 * theme, and the generated local module must stay in step with it:
 *
 * `src/theme/resolved.ts` is the generated module image rendering consumes;
 * the project's theme command stamps the source hash into it. Projects without
 * this optional layout skip the check.
 */

const THEME = record('static.theme', 1);

export function checkThemeFreshness(
  projectRoot: string,
): CheckResult[] {
  const tokensPath = join(projectRoot, 'src/tokens.css');
  if (!existsSync(tokensPath)) {
    return [
      THEME(
        'skip',
        'no src/tokens.css — local theme freshness check not applicable',
      ),
    ];
  }

  const tokensHash = createHash('sha256')
    .update(readFileSync(tokensPath, 'utf8'), 'utf8')
    .digest('hex');

  // Local derivation: the generated resolved module must carry the hash
  // of the CURRENT tokens.css.
  const resolvedPath = join(projectRoot, 'src/theme/resolved.ts');
  const resolvedHash = existsSync(resolvedPath)
    ? (readFileSync(resolvedPath, 'utf8').match(
        /tokensHash = '([0-9a-f]{64})'/,
      )?.[1] ?? null)
    : null;
  if (resolvedHash !== tokensHash) {
    return [
      THEME(
        'fail',
        `src/theme/resolved.ts is ${resolvedHash ? 'stale' : 'missing'} — run \`npm run gen:theme\` (OG images render from it)`,
      ),
    ];
  }

  return [
    THEME('pass', `tokens.css ⇄ resolved module (${tokensHash.slice(0, 12)}…)`),
  ];
}
