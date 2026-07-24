import { describe, expect, it } from 'vitest';

import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  isExpiringSoon,
  parseSessionCookie,
  serializeSessionCookie,
} from './session';

import type { BoardSession } from './session';

const SESSION: BoardSession = {
  accessToken: 'access.jwt.value',
  refreshToken: 'brt_' + 'a'.repeat(64),
  expiresAt: 1781300000000,
};

describe('session cookie codec', () => {
  it('uses the __Host- prefixed cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('__Host-cavuno_board_session');
  });

  it('round-trips a session through serialize → parse', () => {
    const setCookie = serializeSessionCookie(SESSION);
    const cookieHeader = setCookie.split(';')[0]!;
    expect(parseSessionCookie(cookieHeader)).toEqual(SESSION);
  });

  it('serializes with the locked security attributes', () => {
    const setCookie = serializeSessionCookie(SESSION);
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toMatch(/Max-Age=\d+/);
  });

  it('parses the session out of a multi-cookie header', () => {
    const value = serializeSessionCookie(SESSION)
      .split(';')[0]!
      .split('=')
      .slice(1)
      .join('=');
    const header = `other=1; ${SESSION_COOKIE_NAME}=${value}; theme=dark`;
    expect(parseSessionCookie(header)).toEqual(SESSION);
  });

  it('returns null for absent, malformed, or wrong-shape cookies', () => {
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie('')).toBeNull();
    expect(parseSessionCookie('other=1')).toBeNull();
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=not-json`)).toBeNull();
    expect(
      parseSessionCookie(
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ foo: 1 }))}`,
      ),
    ).toBeNull();
  });

  it('clearSessionCookie expires the cookie immediately', () => {
    const cleared = clearSessionCookie();
    expect(cleared).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cleared).toContain('Max-Age=0');
  });
});

describe('isExpiringSoon (proactive-refresh window)', () => {
  it('is false when the access token has more than the window left', () => {
    const now = SESSION.expiresAt - 10 * 60 * 1000;
    expect(isExpiringSoon(SESSION, now)).toBe(false);
  });

  it('is true inside the 5-minute window', () => {
    const now = SESSION.expiresAt - 4 * 60 * 1000;
    expect(isExpiringSoon(SESSION, now)).toBe(true);
  });

  it('is true after expiry', () => {
    const now = SESSION.expiresAt + 1;
    expect(isExpiringSoon(SESSION, now)).toBe(true);
  });
});

describe('malformed percent-escapes (client-controlled header)', () => {
  it('returns null instead of throwing URIError — the documented contract', () => {
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=%`)).toBeNull();
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=%E0%A4`)).toBeNull();
  });
});

describe('board scoping (multi-board origins)', () => {
  it('scoped cookies for two boards never collide; unscoped stays stable', () => {
    const a = { accessToken: 'atA', refreshToken: 'rtA', expiresAt: 1 };
    const b = { accessToken: 'atB', refreshToken: 'rtB', expiresAt: 2 };
    const header = [
      serializeSessionCookie(a, { board: 'pk_boardA' }).split(';')[0],
      serializeSessionCookie(b, { board: 'pk_boardB' }).split(';')[0],
    ].join('; ');
    expect(parseSessionCookie(header, { board: 'pk_boardA' })).toEqual(a);
    expect(parseSessionCookie(header, { board: 'pk_boardB' })).toEqual(b);
    // Unscoped name unchanged (single-board apps keep their cookie).
    expect(
      serializeSessionCookie(a).startsWith(`${SESSION_COOKIE_NAME}=`),
    ).toBe(true);
  });
});
