/**
 * Open-redirect guards — pure URL-safety logic (no cookies involved),
 * transcribed from the hosted board's `validate-redirect-path.ts` and
 * tested against it input-for-input.
 */

/**
 * Guard a `?redirect=` / `?next=` param: a same-origin absolute path only
 * ('/', not '//', no scheme), else `defaultPath` — hosted's
 * `getSafeRedirectPath(path, defaultPath = '/')` shape (the two-arg form is
 * live on the employer sign-up page, which falls back to
 * '/account/connect').
 */
export function safeRedirectPath(
  path: string | undefined | null,
  defaultPath = '/',
): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return defaultPath;
  }
  if (path.includes('://')) return defaultPath;

  // Final backstop against normalization bypasses the string checks miss
  // (hosted parity). Callers resolve redirects with `new URL(path, base)`,
  // and the WHATWG parser turns a backslash into `/` and strips
  // tab/newline/CR — either can escalate a `/`-prefixed string into an
  // off-origin `//host` redirect (e.g. `/\evil.com`, `/<TAB>/evil.com`).
  // Resolve against a sentinel origin and reject any escape.
  try {
    const SENTINEL_ORIGIN = 'https://redirect.invalid';
    if (new URL(path, SENTINEL_ORIGIN).origin !== SENTINEL_ORIGIN) {
      return defaultPath;
    }
  } catch {
    return defaultPath;
  }

  return path;
}

/**
 * The current page path (from the request `Referer`) for the /password
 * redirect-back, guarded by `safeRedirectPath`. Pure — the framework-owned
 * header read happens in the host app's middleware and the value is passed
 * in here, so this stays platform-neutral.
 */
export function currentPathFromReferer(referer: string | null): string {
  if (!referer) return '/';
  try {
    const url = new URL(referer);
    return safeRedirectPath(url.pathname + url.search);
  } catch {
    return '/';
  }
}
