import { describe, expect, it } from 'vitest';

import {
  BOARD_ACCESS_COOKIE_NAME,
  clearGrantCookie,
  currentPathFromReferer,
  parseGrantCookie,
  safeRedirectPath,
  serializeGrantCookie,
} from './index';

describe('grant cookie codec', () => {
  it('serializes a host-owned httpOnly grant cookie and round-trips it', () => {
    const cookie = serializeGrantCookie('hmac-token-abc');
    expect(cookie).toContain(`${BOARD_ACCESS_COOKIE_NAME}=hmac-token-abc`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    // The Set-Cookie value is what the next request sends back as Cookie.
    expect(parseGrantCookie(`${BOARD_ACCESS_COOKIE_NAME}=hmac-token-abc`)).toBe(
      'hmac-token-abc',
    );
  });

  it('parses the grant from a multi-cookie header, ignoring others', () => {
    const header = `theme=dark; ${BOARD_ACCESS_COOKIE_NAME}=tok123; other=x`;
    expect(parseGrantCookie(header)).toBe('tok123');
  });

  it('returns null when absent or empty', () => {
    expect(parseGrantCookie(null)).toBeNull();
    expect(parseGrantCookie('theme=dark')).toBeNull();
    expect(parseGrantCookie(`${BOARD_ACCESS_COOKIE_NAME}=`)).toBeNull();
  });

  it('clear cookie expires it immediately', () => {
    expect(clearGrantCookie()).toContain('Max-Age=0');
  });
});

describe('safeRedirectPath (open-redirect guard)', () => {
  it('keeps a same-origin absolute path', () => {
    expect(safeRedirectPath('/jobs')).toBe('/jobs');
    expect(safeRedirectPath('/companies/acme/jobs/x')).toBe(
      '/companies/acme/jobs/x',
    );
    expect(safeRedirectPath('/jobs?page=2')).toBe('/jobs?page=2');
  });

  it('rejects protocol-relative, scheme, and non-absolute targets → "/"', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('https://evil.com')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(safeRedirectPath('jobs')).toBe('/');
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
  });

  it('rejects URL-normalization bypasses (hosted-parity backstop)', () => {
    // WHATWG URL turns `\` into `/` and strips tab/newline/CR, so these
    // `/`-prefixed strings resolve OFF-origin — the guard must catch them.
    expect(safeRedirectPath('/\\evil.com')).toBe('/');
    expect(safeRedirectPath('/\t/evil.com')).toBe('/');
    expect(safeRedirectPath('/\n/evil.com')).toBe('/');
  });

  it('falls back to the caller defaultPath (hosted two-arg form)', () => {
    // Live hosted call site: employer sign-up falls back to /account/connect.
    expect(safeRedirectPath('//evil.com', '/account/connect')).toBe(
      '/account/connect',
    );
    expect(safeRedirectPath(null, '/account/connect')).toBe('/account/connect');
    expect(safeRedirectPath('/\\evil.com', '/account/connect')).toBe(
      '/account/connect',
    );
    expect(safeRedirectPath('/jobs?x=1', '/account/connect')).toBe('/jobs?x=1');
  });
});

describe('currentPathFromReferer', () => {
  it('extracts path + search from a same-origin referer', () => {
    expect(
      currentPathFromReferer('https://jobs.example.com/jobs?remote=true'),
    ).toBe('/jobs?remote=true');
  });

  it('falls back to "/" for absent or unparseable referers', () => {
    expect(currentPathFromReferer(null)).toBe('/');
    expect(currentPathFromReferer('not a url')).toBe('/');
  });
});

describe('malformed percent-escapes (client-controlled header)', () => {
  it('returns null instead of throwing URIError', () => {
    expect(parseGrantCookie(`${BOARD_ACCESS_COOKIE_NAME}=%`)).toBeNull();
    expect(parseGrantCookie(`${BOARD_ACCESS_COOKIE_NAME}=%E0%A4`)).toBeNull();
  });
});
