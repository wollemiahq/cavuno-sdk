import { describe, expect, it } from 'vitest';

import { scopeToken } from './scope';

// Pins the token FORMAT: `<sanitized>-<djb2 base36 of the raw input>`.
// The format is a wire-adjacent contract — cookies and storage keys derive
// from it — introduced with the scoping feature itself in 1.28.x (no
// pre-existing adopters; see PR #651 discussion).

describe('scopeToken', () => {
  it('pins the sanitize + djb2 format', () => {
    // djb2 of 'acme.jobs' (hash>>>0, base36) — a change to the loop, the
    // seed, or the encoding moves this string.
    expect(scopeToken('acme.jobs')).toBe('acme_jobs-b726on');
    expect(scopeToken('pk_boardA')).toMatch(/^pk_boardA-[a-z0-9]+$/);
  });

  it('distinct raw identifiers never share a token, even when sanitization collides', () => {
    expect(scopeToken('acme.jobs')).not.toBe(scopeToken('acme_jobs'));
    expect(scopeToken('a:b')).not.toBe(scopeToken('a_b'));
    expect(scopeToken('a.b')).not.toBe(scopeToken('a:b'));
  });

  it('stays cookie-name/storage-key safe for hostile input', () => {
    for (const raw of ['', 'ü/π;=', 'a'.repeat(200), ' spaced out ']) {
      expect(scopeToken(raw)).toMatch(/^[a-zA-Z0-9_-]*-[a-z0-9]+$/);
    }
  });

  it('is deterministic', () => {
    expect(scopeToken('acme.jobs')).toBe(scopeToken('acme.jobs'));
  });
});
