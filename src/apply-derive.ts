/**
 * The apply-decision ladder as a pure function — a core-entry
 * derive export like `messaging-derive`, so security/logic fixes ship via
 * the versioned package instead of re-copied registry files. Unit-testable
 * independent of React. Mirrors the hosted board's rule: past the
 * registration wall an external `applicationUrl`, when present, is the
 * apply path for EVERYONE — it is never gated behind verification, so a
 * signed-in-but-unverified candidate is never worse off than an anonymous
 * visitor. The wall itself gates every path including that external link,
 * matching hosted `job-apply-button.tsx`.
 */
export type ApplyAction =
  | { kind: 'external'; url: string }
  /**
   * `reason` says WHY sign-in is required, because callers gate on it:
   * `'registration-wall'` outranks an external-applications-only board
   * (a board with `nativeApplications: false` must still show the wall's
   * sign-in CTA), whereas `'native-apply'` is collapsed away there.
   * Optional — absent on the deprecated `resolveApplyAction` path.
   */
  | { kind: 'sign-in'; reason?: 'registration-wall' | 'native-apply' }
  | { kind: 'verify-email' }
  | { kind: 'native'; jobSlug: string }
  /**
   * Anonymous guest apply — the visitor supplies name/email inline instead
   * of registering. Only reachable when the board's registration wall is
   * OFF and the caller set `allowGuestApply`, mirroring the hosted API,
   * which rejects an anonymous apply only on a walled board.
   */
  | { kind: 'guest'; jobSlug: string }
  | { kind: 'applied' }
  | { kind: 'none' };

/**
 * A job's `applicationUrl` is operator/submitter-controlled and reaches
 * this component through the public API, so it can carry a dangerous
 * scheme (`javascript:`, `data:`, `vbscript:`) that would execute when
 * rendered as an `<a href>`. Only http(s) and mailto are safe apply
 * targets; anything else is treated as no external URL at all.
 */
export function isSafeApplicationUrl(url: string): boolean {
  // Mirror the two normalization steps the browser's URL parser (WHATWG
  // URL Standard) applies BEFORE reading the scheme, or an obfuscated
  // scheme sails through here as "relative" yet executes at click time:
  // 1. remove any leading/trailing C0 control (U+0000–U+001F) or space,
  // 2. remove ASCII tab/LF/CR from ANYWHERE in the input.
  // e.g. `\x00javascript:…` and `java\tscript:…` both normalize to
  // `javascript:…` in the browser, so we must reject them too.
  const cleaned = url
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '')
    .replace(/[\t\n\r]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1]?.toLowerCase();
  // A schemeless value (relative URL) is safe — it can't switch protocol.
  if (scheme === undefined) return true;
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}

export interface ApplyDecisionState {
  jobSlug: string | null;
  applicationUrl: string | null;
  viewer: { emailVerified: boolean } | null;
  applied: boolean;
  /**
   * The board's `features.registrationWall`. When `true` the hosted board
   * requires a signed-in candidate before ANY apply path — the external
   * employer link included. When `false` an anonymous visitor may apply
   * natively as a guest: `POST /jobs/:jobSlug/apply` accepts an
   * unauthenticated caller who supplies name/email, and rejects a guest
   * only when the wall is on.
   *
   * Sign-in — not verification — is the wall's bar, matching hosted: a
   * signed-in-but-unverified candidate clears it.
   */
  registrationWall: boolean;
  /**
   * Does this UI have a guest-apply form to render? Opt-in, because the
   * decision cannot know: a client with no form must keep getting
   * `sign-in`, not a `guest` action it cannot present. Ignored when
   * `registrationWall` is `true` — the wall always wins.
   */
  allowGuestApply?: boolean;
}

/**
 * The full apply ladder including the registration wall. Prefer this over
 * the deprecated `resolveApplyAction`, which cannot see the wall and so
 * hands an anonymous visitor the external employer link on a walled board.
 */
export function resolveApplyDecision(state: ApplyDecisionState): ApplyAction {
  const externalUrl =
    state.applicationUrl && isSafeApplicationUrl(state.applicationUrl)
      ? state.applicationUrl
      : null;

  // Nothing to apply to — decided BEFORE the wall so a walled board does
  // not offer a sign-in CTA that leads to no apply path at all.
  if (!externalUrl && !state.jobSlug) return { kind: 'none' };

  // The wall gates every path, external included.
  if (state.registrationWall && !state.viewer) {
    return { kind: 'sign-in', reason: 'registration-wall' };
  }

  // An external applicationUrl, when present, is the apply path for every
  // viewer past the wall — anonymous, unverified, AND verified — matching
  // the hosted board. (This also keeps an unverified candidate no worse
  // off than an anonymous visitor.) A dangerous-scheme URL is treated as
  // absent — it must never become a clickable href.
  if (externalUrl) return { kind: 'external', url: externalUrl };

  // No external URL below here — the native-apply ladder.
  if (!state.jobSlug) return { kind: 'none' };
  if (!state.viewer) {
    // Wall off ⇒ the API accepts an anonymous guest apply. Forcing sign-in
    // here would lose the application outright, so offer the guest form
    // when the UI has one.
    return state.allowGuestApply
      ? { kind: 'guest', jobSlug: state.jobSlug }
      : { kind: 'sign-in', reason: 'native-apply' };
  }
  if (!state.viewer.emailVerified) return { kind: 'verify-email' };
  if (state.applied) return { kind: 'applied' };
  return { kind: 'native', jobSlug: state.jobSlug };
}

/**
 * @deprecated Wall-blind — use {@link resolveApplyDecision}, which takes
 * the board's `features.registrationWall`. Kept as a one-line forward
 * (`registrationWall: false`) so pinned callers keep their behaviour
 * byte-for-byte; see docs/policy/removals.md.
 */
export function resolveApplyAction(
  state: Omit<ApplyDecisionState, 'registrationWall' | 'allowGuestApply'>,
): ApplyAction {
  // Both new inputs are pinned, not just omitted from the type: a JS caller
  // has no types to stop it, and `allowGuestApply` leaking through would
  // hand a pinned caller a `guest` action its UI cannot render.
  const action = resolveApplyDecision({
    ...state,
    registrationWall: false,
    allowGuestApply: false,
  });
  // Strip the added discriminator so a pinned caller's deep-equality on
  // `{ kind: 'sign-in' }` still holds.
  return action.kind === 'sign-in' ? { kind: 'sign-in' } : action;
}
