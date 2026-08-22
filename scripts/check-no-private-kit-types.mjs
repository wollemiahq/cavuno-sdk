#!/usr/bin/env node
/**
 * Fail if published package contents reference private workspace packages.
 *
 * Scans every path listed in package.json `files[]` (not just dist/), and
 * every text file under those paths (runtime JS/MJS, declarations, skills
 * markdown — not only `.d.ts`). Also always scans `package.json` and
 * `README.md` — npm publishes both even when they are absent from `files[]`.
 *
 * Forbidden names are derived from workspace package manifests
 * (`private: true`) under `packages/` and `apps/` when this script runs
 * inside the private workspace. Outside (public staged repo) the fallback
 * is: the private kit scope, plus any `@cavuno/*` name that is not the
 * public `@cavuno/board` package.
 *
 * Scope strings are assembled at runtime so this source file itself does not
 * contain the contiguous private-scope substring scanned by the public-repo
 * audit.
 */
import { globSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

// Built at runtime so this source never contains the contiguous forbidden
// substrings that the public-repo audit greps for.
const KIT_SCOPE = ['@', 'kit', '/'].join('');
const CAVUNO_SCOPE = ['@', 'cavuno', '/'].join('');
const PUBLIC_CAVUNO_PACKAGE = CAVUNO_SCOPE + 'board';

function walkPackageJsons(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name === '.turbo'
      ) {
        return [];
      }
      return walkPackageJsons(path);
    }
    // Follow symlinked package.json files.
    if (entry.name === 'package.json') {
      const st = statSync(path, { throwIfNoEntry: false });
      if (st?.isFile()) return [path];
    }
    return [];
  });
}

/**
 * Full private package names from the private workspace, or `null` when
 * this script is running outside it (public staged package). Walks both
 * `packages/` and `apps/` so app-private names are visible.
 */
function privatePackageNamesFromWorkspace() {
  const workspaceRoot = resolve(pkgRoot, '../..');
  const packagesDir = resolve(workspaceRoot, 'packages');
  if (!statSync(packagesDir, { throwIfNoEntry: false })?.isDirectory()) {
    return null;
  }
  const names = new Set();
  const roots = [packagesDir, resolve(workspaceRoot, 'apps')];
  for (const root of roots) {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const manifestPath of walkPackageJsons(root)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        // Scoped names only — unscoped app names like `web` appear as
        // ordinary English in published docs and would false-positive on
        // substring match. Private packages that matter for this gate are
        // scoped (kit-scope and non-board cavuno-scope).
        if (
          manifest.private === true &&
          typeof manifest.name === 'string' &&
          manifest.name.startsWith('@')
        ) {
          names.add(manifest.name);
        }
      } catch {
        // skip unreadable/malformed manifests
      }
    }
  }
  return names;
}

/**
 * Walk a directory tree, following symlinks to files and directories.
 * `Dirent.isFile()` is false for symlinks, so callers must resolve them.
 */
function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      const st = statSync(path, { throwIfNoEntry: false });
      if (!st) return [];
      isDir = st.isDirectory();
      isFile = st.isFile();
    }
    if (isDir) return walkFiles(path);
    if (isFile) return [path];
    return [];
  });
}

function isScannedFile(path) {
  return (
    /\.(?:[cm]?[jt]sx?|json|md|mdx|mdoc|txt|map)$/i.test(path) ||
    /(?:^|\/)(?:LICENSE|SKILL\.md)$/i.test(path)
  );
}

function readableText(path) {
  try {
    if (statSync(path).size > 4 * 1024 * 1024) return null;
    const buffer = readFileSync(path);
    if (buffer.includes(0)) return null;
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Return a short description of the first private reference found, or null.
 */
function findPrivateReference(content, privateNames) {
  if (content.includes(KIT_SCOPE)) {
    return KIT_SCOPE;
  }
  if (privateNames) {
    for (const name of privateNames) {
      if (content.includes(name)) return name;
    }
    return null;
  }
  // Public-repo fallback: any @cavuno/* that is not the public board package.
  //
  // `[A-Za-z0-9_-]` deliberately EXCLUDES `.` — including it swallowed the
  // sentence-ending period in prose like "…with @cavuno/board." and reported
  // the package's own name as a private leak, which turned the public repo's
  // CI checks on a clean checkout (13 SKILL.md files + skills/manifest.json).
  // The sibling audits use `/@cavuno\/(?!board\b)[a-z0-9._-]+/i`; the word
  // boundary is what this was missing.
  const re = new RegExp(
    CAVUNO_SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[A-Za-z0-9_-]+',
    'g',
  );
  let match;
  while ((match = re.exec(content)) !== null) {
    const full = match[0];
    if (
      full === PUBLIC_CAVUNO_PACKAGE ||
      full.startsWith(PUBLIC_CAVUNO_PACKAGE + '/')
    ) {
      continue;
    }
    return full;
  }
  return null;
}

/**
 * Expand one `files[]` entry to absolute paths that exist on disk.
 * Supports plain paths and globs (`dist/**`, `skills/**`). Glob patterns
 * that match nothing are still recorded so a total zero-coverage scan can
 * fail loudly rather than reporting success.
 */
function expandFilesEntry(entry) {
  if (/[*?[]/.test(entry)) {
    // Node's globSync returns matching files and directories. Directories
    // are walked further; files are scanned directly.
    return globSync(entry, { cwd: pkgRoot, absolute: true });
  }
  const abs = join(pkgRoot, entry);
  return statSync(abs, { throwIfNoEntry: false }) ? [abs] : [];
}

const manifest = JSON.parse(
  readFileSync(join(pkgRoot, 'package.json'), 'utf8'),
);
const publishedRoots = Array.isArray(manifest.files)
  ? manifest.files
  : ['dist'];
const privateNames = privatePackageNamesFromWorkspace();

const hits = [];
const scanned = new Set();

function scanPath(path) {
  if (scanned.has(path)) return;
  if (!isScannedFile(path)) return;
  const content = readableText(path);
  if (!content) return;
  scanned.add(path);
  const found = findPrivateReference(content, privateNames);
  if (found) {
    hits.push(`${path}: contains ${found}`);
  }
}

// Always-published surfaces npm includes even when absent from `files[]`.
for (const always of ['package.json', 'README.md', 'README']) {
  const abs = join(pkgRoot, always);
  if (statSync(abs, { throwIfNoEntry: false })?.isFile()) {
    scanPath(abs);
  }
}

for (const root of publishedRoots) {
  const expanded = expandFilesEntry(root);
  for (const abs of expanded) {
    const st = statSync(abs, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) {
      for (const path of walkFiles(abs)) {
        scanPath(path);
      }
    } else if (st.isFile()) {
      scanPath(abs);
    }
  }
}

const scannedCount = scanned.size;
console.log(
  `check-no-private-kit-types: scanned ${scannedCount} published file(s)` +
    (privateNames
      ? ` (workspace mode, ${privateNames.size} private package names)`
      : ' (public-repo mode)'),
);

if (scannedCount === 0) {
  console.error(
    'Published package scan covered zero files. Check package.json `files[]` — globs that match nothing, or a missing dist/, silently disable this gate.',
  );
  process.exit(1);
}

if (hits.length) {
  console.error(
    `Published package contents must not reference private workspace packages:\n${hits.join('\n')}`,
  );
  process.exit(1);
}
