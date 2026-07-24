/**
 * Keep `<slug>.cavuno.app` working after a custom-domain cutover by
 * 308-redirecting to the board's canonical custom domain.
 *
 * Pass `primaryDomain` from the public board context. When it is set, a
 * request to a `*.cavuno.app` serving host redirects in one hop while
 * preserving the path and query. A board without a custom domain keeps
 * serving from its cavuno.app hostname.
 */

const CAVUNO_APP_SERVING_SUFFIX = '.cavuno.app';

function normalizeHostname(host: string | null | undefined): string {
  if (!host) return '';
  return host.toLowerCase().split(':')[0] ?? '';
}

function extractPathAndSearch(url: string | null | undefined): string {
  if (!url) return '/';
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return '/';
  }
}

/**
 * True when the request host is a cavuno.app board-serving host
 * (slug or board-hash subdomain), not the apex and not a preview host
 * we deliberately leave alone.
 */
export function isCavunoAppServingHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h.endsWith(CAVUNO_APP_SERVING_SUFFIX)) return false;
  // Apex cavuno.app is the abuse/landing surface — never board serving.
  if (h === 'cavuno.app') return false;
  // Candidate previews stay shareable on their own host (BLD preview).
  if (h.startsWith('preview-')) return false;
  return true;
}

/**
 * When a custom-domain board is hit on its cavuno.app fallback origin,
 * return the one-hop 308 Location to the canonical custom domain.
 * Domainless boards (no primaryDomain) return null — serve in place.
 */
export function getCavunoAppCanonicalRedirectUrl(params: {
  currentHost: string | null;
  /**
   * From `board.context().primaryDomain` — the board's active primary
   * custom domain hostname, or null when domainless.
   */
  primaryDomain: string | null | undefined;
  /** Full request URL or path+query; path+query is preserved on the hop. */
  requestUrl?: string | null;
  defaultPath?: string;
}): string | null {
  const { currentHost, primaryDomain, requestUrl, defaultPath = '/' } = params;

  const canonical = primaryDomain?.trim().toLowerCase().replace(/\.+$/, '');
  if (!canonical) {
    // Domainless: keep serving from cavuno.app.
    return null;
  }

  const hostname = normalizeHostname(currentHost);
  if (!hostname || !isCavunoAppServingHost(hostname)) {
    return null;
  }

  if (hostname === canonical) {
    return null;
  }

  const path =
    requestUrl != null && requestUrl !== ''
      ? extractPathAndSearch(requestUrl)
      : defaultPath;

  return `https://${canonical}${path.startsWith('/') ? path : `/${path}`}`;
}
