import { describe, expect, it } from 'vitest';

import {
  checkCookieCodecConformance,
  hasGeneratedBanner,
  stripComments,
} from './cookie-conformance';

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 *   doctor checks domain-scoped cookie
 * writes; greens the SDK server cookie codec path (including legitimate
 * Set-Cookie attachment of a codec-built host-only value).
 */

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'doctor-cookie-'));
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

describe('stripComments (quote-aware)', () => {
  it('drops trailing // comments but keeps // inside string literals', () => {
    expect(
      stripComments("headers.append('Set-Cookie', cookie); // Domain="),
    ).toBe("headers.append('Set-Cookie', cookie); ");
    expect(
      stripComments(
        "res.headers.append('Set-Cookie', 'ref=https://x; Domain=.evil');",
      ),
    ).toBe("res.headers.append('Set-Cookie', 'ref=https://x; Domain=.evil');");
  });

  it('drops /* block comments */ on the same physical line', () => {
    expect(stripComments('/* set-cookie Domain=.evil forbidden */')).toBe('');
    expect(stripComments('x = 1; /* domain= */ y = 2;')).toBe('x = 1;  y = 2;');
  });
});

describe('checkCookieCodecConformance', () => {
  it('fails a fixture with a document.cookie Domain= write, naming file:line', () => {
    const root = project({
      'src/client.ts':
        'export function set() {\n  document.cookie = "x=1; Domain=.cavuno.app";\n}\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.id).toBe('static.cookie-codec');
    expect(result!.detail).toMatch(/src\/client\.ts:2/);
    expect(result!.detail).toMatch(/document\.cookie/);
    expect(result!.detail).toMatch(/SDK server cookie codec|buildCookie/i);
  });

  it('fails a fixture with raw headers.append Set-Cookie + Domain=', () => {
    const root = project({
      'src/api.ts':
        "headers.append('Set-Cookie', 'x=1; Domain=.cavuno.app; Path=/');\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/api\.ts:1/);
    expect(result!.detail).toMatch(/set-cookie/i);
  });

  it('passes when the SDK codec value is attached via Set-Cookie (no Domain)', () => {
    // The sanctioned path: codec builds the value; caller attaches the header.
    // Must NOT false-positive on the Set-Cookie sink alone.
    const root = project({
      'src/session.ts':
        "import { serializeSessionCookie } from '@cavuno/board/server';\n" +
        'const cookie = serializeSessionCookie(session);\n' +
        "headers.append('Set-Cookie', cookie);\n" +
        'document.cookie = "theme=dark; Path=/";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('passes object-literal Set-Cookie header map with a codec value (no Domain)', () => {
    const root = project({
      'src/route.ts':
        "import { buildCookie } from '@cavuno/board/server';\n" +
        "const cookie = buildCookie('__Host-x', 'v', 3600);\n" +
        "return new Response(null, { headers: { 'Set-Cookie': cookie } });\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('fails multi-line document.cookie = … Domain= (prettier split), naming the sink line', () => {
    const root = project({
      'src/split-doc.ts':
        'export function set() {\n' +
        '  document.cookie =\n' +
        "    'x=1; Domain=.cavuno.app; Path=/';\n" +
        '}\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    // Sink is the document.cookie assignment line (line 2).
    expect(result!.detail).toMatch(/src\/split-doc\.ts:2/);
    expect(result!.detail).toMatch(/document\.cookie/);
  });

  it('fails multi-line Set-Cookie + Domain= (prettier split), naming the sink line', () => {
    const root = project({
      'src/split-header.ts':
        "headers.append('Set-Cookie',\n" + "  'x=1; Domain=.cavuno.app');\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/split-header\.ts:1/);
    expect(result!.detail).toMatch(/set-cookie/i);
  });

  it('passes a document.cookie READ that mentions Domain= (not an assignment)', () => {
    const root = project({
      'src/read.ts':
        'const has = document.cookie.includes("Domain=");\n' +
        'export { has };\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('loud-skips when there is no src/ directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-cookie-nosrc-'));
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('skip');
    expect(result!.detail).toMatch(/src/i);
  });

  it('passes when set-cookie only appears in comments', () => {
    const root = project({
      'src/notes.ts':
        '// set-cookie is set by the edge, not here\n' +
        ' * set-cookie Domain=.evil in a block-comment body line\n' +
        'export const ok = true;\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('passes legitimate Set-Cookie attach with trailing // Domain= comment', () => {
    const root = project({
      'src/attach.ts':
        "import { serializeSessionCookie } from '@cavuno/board/server';\n" +
        'const cookie = serializeSessionCookie(session);\n' +
        "headers.append('Set-Cookie', cookie); // Domain= stripped at edge\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('passes a /* set-cookie Domain= … */ policy comment line', () => {
    const root = project({
      'src/policy.ts':
        '/* set-cookie Domain=.evil is forbidden */\n' +
        'export const ok = true;\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('fails document.cookie += with Domain= (compound assignment)', () => {
    const root = project({
      'src/append.ts': 'document.cookie += "x=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/append\.ts:1/);
    expect(result!.detail).toMatch(/document\.cookie/);
  });

  it('fails when // appears inside a string value before Domain= (no false negative)', () => {
    const root = project({
      'src/url-cookie.ts':
        "res.headers.append('Set-Cookie', 'ref=https://x; Domain=.evil');\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/url-cookie\.ts:1/);
    expect(result!.detail).toMatch(/set-cookie/i);
  });

  it('fails when a regex literal with escaped // sits before document.cookie Domain=', () => {
    // `/https?:\/\//` must not be mistaken for a line comment that drops Domain=.
    const root = project({
      'src/regex-url.ts':
        'const isUrl = /https?:\\/\\//; document.cookie = "x=1; Domain=.evil";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/regex-url\.ts:1/);
    expect(result!.detail).toMatch(/document\.cookie/);
  });

  it('fails when /^\\/\\//.test(…) sits before a domain-scoped document.cookie write', () => {
    const root = project({
      'src/regex-proto.ts':
        'if (!/^\\/\\//.test(path)) document.cookie = "sid=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/regex-proto\.ts:1/);
    expect(result!.detail).toMatch(/document\.cookie/);
  });

  it('passes when Set-Cookie is only in a trailing comment on a non-sink line before domain= code', () => {
    // Sink detection must use the comment-stripped line — otherwise
    // `// Set-Cookie …` with no `;` would open a lookahead into the next
    // line's `domain=` query param and false-red.
    const root = project({
      'src/comment-sink.ts':
        'doStuff() // Set-Cookie handled elsewhere\n' +
        'const u = "https://a?domain=b";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });
});

/**
 * The rule scopes to application-authored code: a tenant cannot fix a finding in
 * a file their build regenerates. Motivating false positive: Paraglide's
 * compiled `src/paraglide/runtime.js` writes the LOCALE cookie behind a
 * tree-shake guard, which red-failed every Paraglide-using board.
 */
describe('generated-source exemption', () => {
  it('skips the Paraglide compiler outdir (src/paraglide/**)', () => {
    const root = project({
      // Verbatim shape of the generated runtime's locale-cookie write.
      'src/paraglide/runtime.js':
        '/* eslint-disable */\n' +
        'export function setLocale(locale) {\n' +
        '  document.cookie = cookieDomain\n' +
        '    ? `${cookieName}=${locale}; path=/; domain=${cookieDomain}`\n' +
        '    : `${cookieName}=${locale}; path=/`;\n' +
        '}\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('skips *.gen.ts output (TanStack routeTree.gen.ts)', () => {
    const root = project({
      'src/routeTree.gen.ts':
        'export const x = () => {\n' +
        '  document.cookie = "x=1; Domain=.cavuno.app";\n' +
        '};\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('skips generated directories at any depth (generated, _generated)', () => {
    const root = project({
      'src/generated/api.ts':
        "headers.append('Set-Cookie', 'x=1; Domain=.cavuno.app');\n",
      'src/lib/_generated/client.ts':
        'document.cookie = "x=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('skips a file whose opening comment carries a generated banner', () => {
    const root = project({
      'src/theme/resolved.ts':
        '/**\n' +
        ' * GENERATED from src/theme.css — do not edit (npm run gen:theme).\n' +
        ' */\n' +
        'document.cookie = "x=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('pass');
  });

  it('still fails app-authored code sitting beside generated output', () => {
    const root = project({
      'src/paraglide/runtime.js':
        'document.cookie = `x=1; domain=${cookieDomain}`;\n',
      'src/routeTree.gen.ts': 'document.cookie = "x=1; Domain=.evil";\n',
      'src/lib/session.ts':
        "headers.append('Set-Cookie', 'sid=1; Domain=.cavuno.app');\n",
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/lib\/session\.ts:1/);
    // Only the app-authored file is named.
    expect(result!.detail).not.toMatch(/paraglide|routeTree/);
  });

  it('does not exempt app files whose names merely contain the markers', () => {
    const root = project({
      'src/paraglide-helpers.ts':
        'document.cookie = "x=1; Domain=.cavuno.app";\n',
      'src/generate.ts': 'document.cookie = "y=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/paraglide-helpers\.ts:1/);
    expect(result!.detail).toMatch(/src\/generate\.ts:1/);
  });

  it('does not exempt a file whose generated marker follows real code', () => {
    const root = project({
      'src/sneaky.ts':
        "import { x } from './x';\n" +
        '// @generated\n' +
        'document.cookie = "x=1; Domain=.cavuno.app";\n',
    });
    const [result] = checkCookieCodecConformance(root);
    expect(result!.status).toBe('fail');
    expect(result!.detail).toMatch(/src\/sneaky\.ts:3/);
  });
});

describe('hasGeneratedBanner (opening comment block only)', () => {
  it('accepts a banner after an eslint pragma and a blank line', () => {
    expect(
      hasGeneratedBanner('/* eslint-disable */\n\n// @generated\nconst a = 1;'),
    ).toBe(true);
  });

  it('accepts do-not-edit and generated-by phrasings', () => {
    expect(hasGeneratedBanner('// DO NOT EDIT — run gen:theme\n')).toBe(true);
    expect(hasGeneratedBanner('/* Generated by openapi-typescript */\n')).toBe(
      true,
    );
    expect(hasGeneratedBanner('// This file is auto-generated.\n')).toBe(true);
  });

  it('rejects a marker past the opening comment block or the head window', () => {
    expect(hasGeneratedBanner('const a = 1;\n// @generated\n')).toBe(false);
    expect(hasGeneratedBanner('//1\n//2\n//3\n//4\n//5\n// @generated\n')).toBe(
      false,
    );
  });

  it('rejects an ordinary file with no banner', () => {
    expect(hasGeneratedBanner("import { x } from './x';\n")).toBe(false);
  });
});
