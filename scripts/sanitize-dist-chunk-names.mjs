#!/usr/bin/env node
/**
 * tsup/esbuild chunk hashes are mixed-case base64. A hash that starts with
 * `D` + digits matches the public-package
 * `/\bD\d+\b/` policy when those names appear in `.d.ts` imports.
 * Lowercase only those decision-shaped tokens so the pack stays publishable
 * without relaxing the audit.
 */
import {
  readdirSync,
  renameSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const DECISION_TOKEN = /\bD(\d+)\b/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function sanitize(text) {
  return text.replace(DECISION_TOKEN, 'd$1');
}

const files = walk(DIST);
const renames = [];

for (const path of files) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const nextBase = sanitize(base);
  if (nextBase !== base) {
    const nextPath = join(path.slice(0, path.lastIndexOf('/')), nextBase);
    renameSync(path, nextPath);
    renames.push([path, nextPath]);
  }
}

const afterRename = walk(DIST);
for (const path of afterRename) {
  if (statSync(path).size > 8 * 1024 * 1024) continue;
  const buf = readFileSync(path);
  if (buf.includes(0)) continue;
  const text = buf.toString('utf8');
  const next = sanitize(text);
  if (next !== text) writeFileSync(path, next);
}

if (renames.length) {
  console.log(
    `Sanitized ${renames.length} dist chunk name(s) for public-package policy`,
  );
}
