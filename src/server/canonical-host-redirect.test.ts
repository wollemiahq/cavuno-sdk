import { describe, expect, it } from 'vitest';

import {
  getCavunoAppCanonicalRedirectUrl,
  isCavunoAppServingHost,
} from './canonical-host-redirect';

describe('cavuno.app → canonical custom domain', () => {
  it('Post-cutover custom-domain fixture — deep URL on <slug>.cavuno.app 308s to the same path on the canonical domain in one hop', () => {
    const target = getCavunoAppCanonicalRedirectUrl({
      currentHost: 'acme.cavuno.app',
      primaryDomain: 'jobs.acme.com',
      requestUrl: 'https://acme.cavuno.app/jobs/engineering?q=rust',
    });
    expect(target).toBe('https://jobs.acme.com/jobs/engineering?q=rust');
    // One hop — no intermediate host.
    expect(target).not.toContain('.cavuno.app');
    expect(target).not.toContain('.cavuno.com');
  });

  it('the domainless fixture continues to SERVE from <slug>.cavuno.app', () => {
    expect(
      getCavunoAppCanonicalRedirectUrl({
        currentHost: 'acme.cavuno.app',
        primaryDomain: null,
        requestUrl: 'https://acme.cavuno.app/jobs/engineering',
      }),
    ).toBeNull();
    expect(
      getCavunoAppCanonicalRedirectUrl({
        currentHost: 'acme.cavuno.app',
        primaryDomain: undefined,
        requestUrl: 'https://acme.cavuno.app/',
      }),
    ).toBeNull();
  });

  it('does not redirect when already on the canonical host', () => {
    expect(
      getCavunoAppCanonicalRedirectUrl({
        currentHost: 'jobs.acme.com',
        primaryDomain: 'jobs.acme.com',
        requestUrl: 'https://jobs.acme.com/jobs',
      }),
    ).toBeNull();
  });

  it('ignores apex and preview hosts', () => {
    expect(isCavunoAppServingHost('cavuno.app')).toBe(false);
    expect(isCavunoAppServingHost('preview-abc.cavuno.app')).toBe(false);
    expect(isCavunoAppServingHost('acme.cavuno.app')).toBe(true);
    expect(
      getCavunoAppCanonicalRedirectUrl({
        currentHost: 'preview-abc.cavuno.app',
        primaryDomain: 'jobs.acme.com',
        requestUrl: 'https://preview-abc.cavuno.app/',
      }),
    ).toBeNull();
  });
});
