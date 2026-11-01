import { describe, expect, it, vi } from 'vitest';

import { probeLocalizedUrls, translatedStaticRoles } from './localized-urls';
import { runReadProbes } from './read';

const BASE = 'https://front.example';

const DUTCH_ROLES = {
  home: '/',
  jobs: '/vacatures',
  companies: '/bedrijven',
  company: '/bedrijven/:companySlug',
  blog: '/blog',
  about: '/over-ons',
  alertsManage: '/vacaturemail/beheren',
  privacyPolicy: '/privacy',
} as const;

const DUTCH_MANIFEST = { version: 1, roles: DUTCH_ROLES };

/** English → Dutch for the translated static roles above. */
const TRANSLATED: Record<string, string> = {
  '/jobs': '/vacatures',
  '/companies': '/bedrijven',
  '/about': '/over-ons',
  '/alerts/manage': '/vacaturemail/beheren',
  '/privacy-policy': '/privacy',
};

type Hop = { status: number; location?: string };

/** A board that 308s English paths and serves its Dutch ones, with overrides. */
function board(overrides: Record<string, Hop> = {}) {
  const routes: Record<string, Hop> = {};
  for (const [english, dutch] of Object.entries(TRANSLATED)) {
    routes[english] = { status: 308, location: dutch };
    routes[dutch] = { status: 200 };
  }
  Object.assign(routes, overrides);
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.redirect).toBe('manual');
    const url = new URL(String(input));
    const hop = routes[`${url.pathname}${url.search}`];
    if (!hop) return new Response('', { status: 404 });
    return new Response(null, {
      status: hop.status,
      headers: hop.location ? { Location: hop.location } : {},
    });
  });
}

describe('translatedStaticRoles', () => {
  it('pairs each translated static role with its canonical English path', () => {
    expect(translatedStaticRoles(DUTCH_MANIFEST)).toEqual([
      { role: 'jobs', english: '/jobs', localized: '/vacatures' },
      { role: 'companies', english: '/companies', localized: '/bedrijven' },
      { role: 'about', english: '/about', localized: '/over-ons' },
      {
        role: 'privacyPolicy',
        english: '/privacy-policy',
        localized: '/privacy',
      },
      {
        role: 'alertsManage',
        english: '/alerts/manage',
        localized: '/vacaturemail/beheren',
      },
    ]);
  });

  it('ignores renamed routes whose shape differs from the English one', () => {
    expect(
      translatedStaticRoles({ version: 1, roles: { jobs: '/werk/vacatures' } }),
    ).toEqual([]);
  });
});

describe('read.localizedUrls', () => {
  it('passes when every English path 308s to the exact Dutch path and it answers', async () => {
    const fetchImpl = board();
    const result = await probeLocalizedUrls(fetchImpl, BASE, DUTCH_MANIFEST);
    expect(result).toMatchObject({ id: 'read.localizedUrls', status: 'pass' });
    expect(result.detail).toContain('/jobs → /vacatures');
    // Two hops per translated role, nothing else.
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });

  it('accepts an absolute same-origin Location', async () => {
    const result = await probeLocalizedUrls(
      board({ '/jobs': { status: 308, location: `${BASE}/vacatures` } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('pass');
  });

  it('fails naming the role when the 308 points at the wrong word', async () => {
    const result = await probeLocalizedUrls(
      board({ '/companies': { status: 308, location: '/werkgevers' } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('fail');
    expect(result.detail).toBe(
      'companies: /companies → 308 to /werkgevers, expected /bedrijven',
    );
  });

  it('fails when the English path is served instead of redirected', async () => {
    const result = await probeLocalizedUrls(
      board({ '/jobs': { status: 200 } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.detail).toBe(
      'jobs: /jobs → HTTP 200, expected 308 to /vacatures',
    );
  });

  it('fails a 308 that leaves the board origin', async () => {
    const result = await probeLocalizedUrls(
      board({
        '/jobs': { status: 308, location: 'https://evil.example/vacatures' },
      }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('fail');
    expect(result.detail).toContain("off the board's origin");
  });

  it('fails when the localized page errors', async () => {
    const result = await probeLocalizedUrls(
      board({ '/vacatures': { status: 500 } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('fail');
    expect(result.detail).toBe('jobs: /vacatures → HTTP 500, expected 2xx');
  });

  it.each([
    '/password?redirect=%2Fover-ons',
    '/wachtwoord?redirect=%2Fover-ons',
  ])('never counts a redirect to the password gate (%s)', async (location) => {
    const result = await probeLocalizedUrls(
      board({ '/over-ons': { status: 307, location } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('fail');
    expect(result.detail).toContain(
      "about: /over-ons → HTTP 307 to the board's access gate",
    );
  });

  it.each(['/password', '/wachtwoord?redirect=%2Fvacaturemail%2Fbeheren'])(
    'never counts a password-gate redirect even on pages that may redirect (%s)',
    async (location) => {
      const result = await probeLocalizedUrls(
        board({ '/vacaturemail/beheren': { status: 307, location } }),
        BASE,
        DUTCH_MANIFEST,
      );
      expect(result.status).toBe('fail');
      expect(result.detail).toContain(
        "alertsManage: /vacaturemail/beheren → HTTP 307 to the board's access gate",
      );
    },
  );

  it('lets token pages redirect within the board, but not off it', async () => {
    const inside = await probeLocalizedUrls(
      board({
        '/vacaturemail/beheren': { status: 307, location: '/auth/inloggen' },
      }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(inside.status).toBe('pass');

    const outside = await probeLocalizedUrls(
      board({
        '/vacaturemail/beheren': {
          status: 307,
          location: 'https://elsewhere.example/login',
        },
      }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(outside.status).toBe('fail');
  });

  it('lets the purchases library send a signed-out visitor to sign in', async () => {
    const manifest = {
      version: 1,
      roles: { ...DUTCH_ROLES, mePurchases: '/mijn/aankopen' },
    };
    const result = await probeLocalizedUrls(
      board({
        '/me/purchases': { status: 308, location: '/mijn/aankopen' },
        '/mijn/aankopen': {
          status: 307,
          location: '/auth/inloggen?returnTo=%2Fme%2Faankopen',
        },
      }),
      BASE,
      manifest,
    );
    expect(result.status).toBe('pass');
  });

  it('does not let content pages redirect', async () => {
    const result = await probeLocalizedUrls(
      board({ '/bedrijven': { status: 302, location: '/' } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.detail).toBe(
      'companies: /bedrijven → HTTP 302 to /, expected 2xx',
    );
  });

  it('accepts a 404 for a page the board has not published', async () => {
    const result = await probeLocalizedUrls(
      board({ '/privacy': { status: 404 } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('pass');
  });

  it('accepts a 404 for an about page or blog the board has switched off', async () => {
    const result = await probeLocalizedUrls(
      board({ '/over-ons': { status: 404 } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('pass');
  });

  it('still fails a 404 on a page every board serves', async () => {
    const result = await probeLocalizedUrls(
      board({ '/bedrijven': { status: 404 } }),
      BASE,
      DUTCH_MANIFEST,
    );
    expect(result.status).toBe('fail');
  });

  it.each([
    [
      'an English manifest',
      { version: 1, roles: { home: '/', jobs: '/jobs' } },
    ],
    ['no manifest', null],
    ['an invalid manifest', { version: 2, roles: DUTCH_ROLES }],
  ])(
    'is not applicable for %s and sends no requests',
    async (_name, manifest) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const result = await probeLocalizedUrls(fetchImpl, BASE, manifest);
      expect(result.status).toBe('skip');
      expect(result.detail).toMatch(/^not applicable/);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('read tier wiring', () => {
  function urls(fetchImpl: ReturnType<typeof vi.fn>) {
    return fetchImpl.mock.calls.map(
      ([input]) => new URL(String(input)).pathname,
    );
  }

  it('reads the manifest once and adds no requests for an English board', async () => {
    const english = JSON.stringify({ version: 1, roles: { jobs: '/jobs' } });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).pathname === '/.well-known/cavuno.json'
        ? new Response(english)
        : new Response('', { status: 404 }),
    );
    const results = await runReadProbes(fetchImpl, BASE);
    expect(results.find((r) => r.id === 'read.localizedUrls')?.status).toBe(
      'skip',
    );
    const seen = urls(fetchImpl);
    expect(seen.filter((p) => p === '/.well-known/cavuno.json')).toHaveLength(
      1,
    );
    expect(seen).not.toContain('/about');
  });

  it('reads the manifest once and probes a Dutch board', async () => {
    const hops = board();
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) =>
        new URL(String(input)).pathname === '/.well-known/cavuno.json'
          ? new Response(JSON.stringify(DUTCH_MANIFEST))
          : init?.redirect === 'manual'
            ? hops(input, init)
            : new Response('', { status: 404 }),
    );
    const results = await runReadProbes(fetchImpl, BASE);
    expect(results.find((r) => r.id === 'read.localizedUrls')?.status).toBe(
      'pass',
    );
    expect(
      urls(fetchImpl).filter((p) => p === '/.well-known/cavuno.json'),
    ).toHaveLength(1);
  });
});
