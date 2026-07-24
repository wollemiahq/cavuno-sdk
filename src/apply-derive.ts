/**
 * The apply-decision ladder as a pure function — a core-entry
 * derive export like `messaging-derive`, so security/logic fixes ship via
 * the versioned package instead of re-copied registry files. Unit-testable
 * independent of React. Mirrors the hosted board's rule: an external
 * `applicationUrl`, when present, is the apply path for EVERYONE — it is
 * never gated behind auth or verification, so a signed-in-but-unverified
 * candidate is never worse off than an anonymous visitor.
 */
export type ApplyAction =
  | { kind: 'external'; url: string }
  | { kind: 'sign-in' }
  | { kind: 'verify-email' }
  | { kind: 'native'; jobSlug: string }
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

export function resolveApplyAction(state: {
  jobSlug: string | null;
  applicationUrl: string | null;
  viewer: { emailVerified: boolean } | null;
  applied: boolean;
}): ApplyAction {
  // An external applicationUrl, when present, is the apply path for
  // EVERYONE — anonymous, unverified, AND verified — matching the hosted
  // board, which shows the external link unconditionally when present.
  // (This also keeps an unverified candidate no worse off than anonymous.)
  // A dangerous-scheme URL is treated as absent — it must never become a
  // clickable href.
  if (state.applicationUrl && isSafeApplicationUrl(state.applicationUrl)) {
    return { kind: 'external', url: state.applicationUrl };
  }

  // No external URL below here — the native-apply ladder.
  if (!state.jobSlug) return { kind: 'none' };
  if (!state.viewer) return { kind: 'sign-in' };
  if (!state.viewer.emailVerified) return { kind: 'verify-email' };
  if (state.applied) return { kind: 'applied' };
  return { kind: 'native', jobSlug: state.jobSlug };
}
