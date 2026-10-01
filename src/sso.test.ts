import { describe, expect, it } from 'vitest';

import {
  SSO_LINK_PROOF_BINDING_TTL_MS,
  SIGN_IN_REDIRECT_ERROR_CODES,
  parseOAuthCompletion,
  ssoLinkProofBindingStore,
} from './sso';

describe('parseOAuthCompletion', () => {
  it('retains the legacy SSO redirect code alongside method availability', () => {
    expect(SIGN_IN_REDIRECT_ERROR_CODES).toContain('sso_required');
    expect(SIGN_IN_REDIRECT_ERROR_CODES).toContain('method_unavailable');
  });
  it('reads a token completion with method, role and new-user flag', () => {
    expect(
      parseOAuthCompletion(
        '?token=tok&returnTo=%2Fjobs&method=sso&role=employer&isNew=1',
      ),
    ).toEqual({
      kind: 'token',
      token: 'tok',
      method: 'sso',
      role: 'employer',
      returnTo: '/jobs',
      isNewUser: true,
    });
  });

  it('reads a Google completion without isNew as an existing user', () => {
    const completion = parseOAuthCompletion(
      new URLSearchParams({ token: 'tok', method: 'google', returnTo: '/' }),
    );
    expect(completion).toMatchObject({ kind: 'token', isNewUser: false });
  });

  it('reads the proof-sent state with its browser binding', () => {
    expect(
      parseOAuthCompletion({
        status: 'sso_link_proof_sent',
        linkProofBinding: 'bind',
        returnTo: '/account',
        method: 'sso',
        role: 'candidate',
      }),
    ).toEqual({
      kind: 'link_proof_sent',
      linkProofBinding: 'bind',
      role: 'candidate',
      returnTo: '/account',
    });
  });

  it('reads the emailed proof link', () => {
    expect(
      parseOAuthCompletion(
        'https://jobs.example.com/auth/oauth-complete?linkProof=proof&method=sso&role=candidate&returnTo=%2F',
      ),
    ).toEqual({
      kind: 'link_proof',
      linkProof: 'proof',
      role: 'candidate',
      returnTo: '/',
    });
  });

  it('reads a sign-in error ahead of anything else', () => {
    expect(parseOAuthCompletion('?error=sso_cancelled&token=tok')).toEqual({
      kind: 'error',
      error: 'sso_cancelled',
      returnTo: '/',
    });
  });

  it('never returns an off-site returnTo', () => {
    for (const unsafe of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      // Browsers strip tab and newline from URLs, leaving `//evil.example`.
      '/\t/evil.example',
      '/\n/evil.example',
      'javascript:alert(1)',
    ]) {
      const completion = parseOAuthCompletion({
        token: 'tok',
        returnTo: unsafe,
      });
      expect(completion.returnTo).toBe('/');
    }
  });

  it('is invalid without a token, proof or error, and ignores an unknown role', () => {
    expect(parseOAuthCompletion('?status=sso_link_proof_sent')).toEqual({
      kind: 'invalid',
      returnTo: '/',
    });
    expect(parseOAuthCompletion('?token=t&role=admin')).toMatchObject({
      role: null,
    });
  });
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('ssoLinkProofBindingStore', () => {
  it('round-trips a binding, scoped per board', () => {
    const storage = memoryStorage();
    const acme = ssoLinkProofBindingStore('pk_acme', { storage });
    const other = ssoLinkProofBindingStore('pk_other', { storage });
    const secret = acme.begin();
    acme.save('transferred-binding');
    expect(acme.read()).toBe(secret);
    other.save('transferred-binding');
    expect(other.read()).toBeNull();
  });

  it('expires after the full 25-minute flow window and forgets the entry', () => {
    const storage = memoryStorage();
    let now = 1_000;
    const store = ssoLinkProofBindingStore('pk_acme', {
      storage,
      now: () => now,
    });
    const binding = store.begin();
    expect(SSO_LINK_PROOF_BINDING_TTL_MS).toBe(25 * 60 * 1000);
    now += SSO_LINK_PROOF_BINDING_TTL_MS - 1;
    expect(store.read()).toBe(binding);
    now += 1;
    expect(store.read()).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('clears on demand and treats a corrupt entry as absent', () => {
    const storage = memoryStorage();
    const store = ssoLinkProofBindingStore('pk_acme', { storage });
    store.begin();
    store.clear();
    expect(store.read()).toBeNull();
    expect(storage.map.size).toBe(0);

    store.begin();
    const [key] = [...storage.map.keys()];
    storage.map.set(key!, 'not json');
    expect(store.read()).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('refuses initiation where no storage exists and URL saves remain inert', () => {
    const store = ssoLinkProofBindingStore('pk_acme');
    expect(() => store.begin()).toThrow(/SSO requires browser storage/);
    expect(() => store.save('bind')).not.toThrow();
    expect(store.read()).toBeNull();
  });
});
