/**
 *cookie-codec conformance.
 *
 * Starter / consumer code must not domain-scope cookies on the shared
 * origin. The SDK server cookie codec (`buildCookie` / `buildClearCookie`
 * / `serializeSessionCookie` from `@cavuno/board/server`) mints host-only
 * `__Host-` values; attaching those via `Set-Cookie` is the sanctioned
 * path and is GREEN. Domain-scoped writes (raw `Set-Cookie` with
 * `Domain=`, or `document.cookie = … Domain=`) are RED.
 *
 * Caveat: the doctor is accountability tooling,
 * not a security boundary. Tenants remain identifiable paying customers
 * with an audit trail; this check does not prevent determined abuse.
 *
 * Scope: application-authored source only. Generated output under `src/` is
 * skipped (see GENERATED_DIRS / GENERATED_FILE / hasGeneratedBanner) —
 * a tenant cannot fix a finding in a file their build regenerates, so
 * flagging one is pure noise. The motivating case is Paraglide JS: its
 * compiler writes `src/paraglide/**` (gitignored in the starter) and
 * `runtime.js` contains a `document.cookie = … cookieDomain` write for
 * Paraglide's own LOCALE cookie strategy — dead behind a
 * `TREE_SHAKE_COOKIE_STRATEGY_USED` guard on a board compiled without
 * the cookie strategy, and unfixable by the consumer either way.
 *
 * Why not `.gitignore`? It is the most correct signal, but parsing it
 * faithfully (nested files, negations, precedence, dir-vs-path anchors)
 * needs a dependency the SDK will not take, and shelling out to
 * `git check-ignore` assumes both a git binary and a git working tree —
 * neither holds for platform-built tenant projects. The pattern list
 * plus the banner heuristic covers the generators this supported projects actually
 * runs without either assumption.
 */

import { record, type CheckResult } from './checks';

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COOKIE = record('static.cookie-codec', 1);

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|astro|svelte|vue)$/;

const REMEDIATION =
  'set cookies only through the SDK server cookie codec (buildCookie/buildClearCookie from @cavuno/board/server)';

/**
 * Set-Cookie header sink. Intentionally bare `/set-cookie/i` — also matches
 * header READS (e.g. `headers.get('Set-Cookie')`), so a read sitting within
 * LOOKAHEAD_LINES of a `domain=` will false-RED. Accepted: safe false-red
 * direction for accountability tooling. Narrowing to writer-only call shapes
 * (`.append(`, `.set(`, object-literal key) would create FALSE NEGATIVES on
 * non-standard write APIs (`setHeader`, index assignment, framework helpers)
 * — the wrong direction for this control. Reads of Set-Cookie are rare in a
 * board starter (starters SET via the SDK codec).
 */
const SET_COOKIE_SINK = /set-cookie/i;
/**
 * document.cookie assignment — plain `=` or compound `+=`, never `==` /
 * `===`, so reads like `document.cookie.includes("Domain=")` never trip.
 */
const DOCUMENT_COOKIE_ASSIGN = /document\.cookie\s*\+?=(?!=)/i;
/**
 * Domain attribute on a cookie write. `=` only: both sinks express Domain
 * as `Domain=` in a cookie string. Matching the object-property `domain:`
 * form would false-checks the legitimate host-scoped analytics module
 * when it sits near a Set-Cookie attach.
 *
 * Whole-statement substring match (run against the comment-stripped
 * statement window), NOT the segment/attribute-aware parse the edge
 * firewall uses (`stripDomainFromSetCookie`). A codec-built cookie whose
 * VALUE contains the substring `domain=` (e.g. a redirect URL `?domain=…`)
 * will therefore false-RED. That is the intentional, safe failure direction
 * for accountability tooling — this module is explicitly not a security
 * boundary — and differs deliberately from the edge's per-attribute match.
 */
const DOMAIN_SCOPE = /domain\s*=/i;

/**
 * Max physical non-comment lines to look ahead after a sink without Domain.
 * Prettier-style splits of a cookie write are typically 1–2 continuation
 * lines before the terminating `;`; 3 covers those with margin. A
 * pathological write split across more than 3 non-comment lines can evade
 * detection — accepted because this is a red/green accountability gate, not
 * a hard boundary, and a larger window widens the false-positive surface.
 *
 * Forward-only, sink-anchored: a domain-scoped cookie whose value is
 * assembled on an EARLIER line and passed by reference — e.g.
 *   const cookie = `sid=${id}; Domain=.cavuno.app`;
 *   headers.append('Set-Cookie', cookie);
 * — is not caught (the attach line is a complete statement with no Domain=,
 * and the builder line is not a sink). More generally any variable/data-flow
 * indirection defeats this cheap text scan. Accepted because (a) the doctor
 * is accountability tooling, not a security boundary, and (b) the
 * dispatch-edge firewall (stripDomainFromSetCookie) neutralizes such a
 * cookie at runtime regardless of how its value was built. Do not add a
 * backward scan — it would widen false-positive surface and still miss
 * deeper indirection.
 */
const LOOKAHEAD_LINES = 3;

/**
 * Remove `//` line comments and `/* … *​/` block comments from one physical
 * line, quote-aware so `//` or `/*` inside `'…'` / `"…"` / `` `…` `` are
 * kept. A backslash escapes the next char inside a string. Unterminated
 * block comments drop to EOL (scan is per physical line).
 */
export function stripComments(line: string): string {
  let out = '';
  let i = 0;
  let quote: "'" | '"' | '`' | null = null;

  while (i < line.length) {
    const c = line[i]!;

    if (quote !== null) {
      out += c;
      if (c === '\\' && i + 1 < line.length) {
        out += line[i + 1]!;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }

    // Regex escaped-slash (`\/\/`) is not a comment opener — a preceding
    // `\` means emit `/` as code. Real trailing comments are never
    // preceded by `\`, so this does not reintroduce comment false-positives.
    if (c === '/' && i + 1 < line.length && line[i - 1] !== '\\') {
      const next = line[i + 1]!;
      if (next === '/') {
        // Line comment — drop remainder of this physical line.
        break;
      }
      if (next === '*') {
        // Block comment — drop until */ or EOL.
        i += 2;
        while (i < line.length) {
          if (line[i] === '*' && i + 1 < line.length && line[i + 1] === '/') {
            i += 2;
            break;
          }
          i += 1;
        }
        continue;
      }
    }

    out += c;
    i += 1;
  }

  return out;
}

/**
 * Pure comment / blank / block-comment body lines are not sinks and are
 * skipped in the statement lookahead. stripComments-empty catches
 * `// …` and `/* … *​/`; `*` prefix still covers block-comment
 * continuation body lines that have no opener on the same physical line.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('*')) return true;
  return stripComments(line).trim() === '';
}

function hasCookieWriteSink(line: string): boolean {
  return SET_COOKIE_SINK.test(line) || DOCUMENT_COOKIE_ASSIGN.test(line);
}

/**
 * Join sink + a small following-line window so prettier-split writes are
 * still red. Comment text is stripped before join so Domain= inside
 * comments cannot false-red. Stops at a stripped line containing `;`
 * (inclusive) or after LOOKAHEAD_LINES non-comment lines.
 *
 * Looks only FORWARD from the sink (see LOOKAHEAD_LINES for the accepted
 * prior-line value-assembly false-negative).
 */
function statementWindow(lines: string[], sinkIdx: number): string {
  const sinkStripped = stripComments(lines[sinkIdx]!);
  const parts: string[] = [sinkStripped];
  // Statement already complete on the sink line — no cross-line join.
  if (sinkStripped.includes(';')) return sinkStripped;

  let taken = 0;
  for (
    let j = sinkIdx + 1;
    j < lines.length && taken < LOOKAHEAD_LINES;
    j += 1
  ) {
    const next = lines[j]!;
    if (isCommentLine(next)) continue;
    const stripped = stripComments(next);
    parts.push(stripped);
    taken += 1;
    if (stripped.includes(';')) break;
  }
  return parts.join('\n');
}

/**
 * True when this line is a cookie-write sink whose logical statement
 * domain-scopes the cookie. Finding is always attributed to the sink line
 * (original text). Sink detection and domain-scope both use
 * comment-stripped code so a trailing `// Set-Cookie …` comment alone
 * cannot open a lookahead that false-reds a following `domain=` line.
 */
function isOffendingSink(lines: string[], index: number): boolean {
  const line = lines[index]!;
  if (isCommentLine(line)) return false;
  const stripped = stripComments(line);
  if (!hasCookieWriteSink(stripped)) return false;
  return DOMAIN_SCOPE.test(statementWindow(lines, index));
}

/**
 * Directory names that hold machine-generated output, matched at any
 * depth under `src/`. `paraglide` is the Paraglide JS compiler outdir
 * (the starter's `gen:paraglide` writes `./src/paraglide`); `generated`
 * / `_generated` / `__generated__` are common code-generation conventions
 * (GraphQL codegen, Prisma, and many framework generators).
 */
const GENERATED_DIRS = new Set([
  'paraglide',
  'generated',
  '_generated',
  '__generated__',
]);

/**
 * The `.gen.` filename convention for generated modules — TanStack
 * Router's `src/routeTree.gen.ts` above all, which every Start-based
 * board regenerates on each build.
 */
const GENERATED_FILE = /\.gen\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

/**
 * Banner markers a generator writes into its output's opening comment.
 * Covers generators this list does not name — the long tail (`gen:theme`
 * stamps `GENERATED from src/theme.css — do not edit`).
 */
const GENERATED_BANNER =
  /@generated|generated by|generated from|auto-?generated|do not edit|don't edit/i;

/** Physical lines of the file head considered for the banner. */
const BANNER_SCAN_LINES = 5;

/**
 * True when the file's OPENING comment block declares it generated.
 * Deliberately conservative: the scan stops at the first line carrying
 * code, so a marker buried mid-file (or in a comment after the imports)
 * never exempts anything. Blank lines are transparent — generators
 * commonly emit `/* eslint-disable *​/`, a blank, then the banner.
 *
 * Yes, a tenant could hand-write `// @generated` to silence a finding.
 * That is not a new hole: the scan is a text heuristic that variable
 * indirection already defeats (see LOOKAHEAD_LINES), the doctor is
 * explicitly not a security boundary, and the dispatch-edge firewall
 * (stripDomainFromSetCookie) neutralizes a domain-scoped cookie at
 * runtime regardless of what doctor said.
 */
export function hasGeneratedBanner(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const limit = Math.min(lines.length, BANNER_SCAN_LINES);
  for (let i = 0; i < limit; i += 1) {
    const line = lines[i]!;
    // Comment or blank; anything else is code — the banner block is over.
    if (!isCommentLine(line)) return false;
    if (GENERATED_BANNER.test(line)) return true;
  }
  return false;
}

function walkSourceFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (GENERATED_DIRS.has(name) || GENERATED_FILE.test(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (st.isFile() && SOURCE_EXT.test(name)) {
      out.push(full);
    }
  }
}

function truncate(line: string, max = 120): string {
  const t = line.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Scan the app-authored files under `<projectRoot>/src` for
 * domain-scoped cookie writes; generated output is skipped (module
 * header). No src/ → loud skip (theme.ts style). Findings → one fail
 * CheckResult.
 */
export function checkCookieCodecConformance(
  projectRoot: string,
): CheckResult[] {
  const srcDir = join(projectRoot, 'src');
  if (!existsSync(srcDir)) {
    return [
      COOKIE(
        'skip',
        'no src/ directory — cookie-codec conformance scan skipped',
      ),
    ];
  }

  const files: string[] = [];
  walkSourceFiles(srcDir, files);

  const findings: string[] = [];
  for (const file of files) {
    const rel = relative(projectRoot, file).split('\\').join('/');
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Generated output the consumer cannot fix — see the module header.
    if (hasGeneratedBanner(text)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (!isOffendingSink(lines, i)) continue;
      findings.push(`${rel}:${i + 1} — ${truncate(lines[i]!)}`);
    }
  }

  if (findings.length === 0) {
    return [
      COOKIE(
        'pass',
        'no domain-scoped Set-Cookie or document.cookie writes in app-authored src/ (generated output skipped)',
      ),
    ];
  }

  return [COOKIE('fail', `${findings.join('; ')}; ${REMEDIATION}`)];
}
