import { describe, expect, it, vi } from 'vitest';

import { runReadProbes } from './read';

const HOME_HTML = `<html><head></head><body><div>home</div>
  <a href="/companies/acme/jobs/eng">Eng</a>
</body></html>`;

const JOB_HTML = `<html><body>
  <a href="/companies/acme/jobs/eng">Eng</a>
  <script type="application/ld+json">{"@type":"JobPosting","title":"Eng"}</script>
</body></html>`;

const SITEMAP =
  '<urlset><url><loc>https://front.example/jobs</loc></url></urlset>';

const ROBOTS = `User-agent: *
Disallow: /go/
Sitemap: https://jobs.example.com/sitemap.xml
`;

const SEO = {
  canonicalBase: 'https://jobs.example.com',
  adsTxt: 'google.com, pub-1, DIRECT, f08c47fec0942fa0',
  indexNowKey: 'idx-key',
  googleSiteVerification: 'gsc-token',
};

function fetchMap(routes: Record<string, { status?: number; body?: string }>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  return vi.fn(async (input: RequestInfo | URL) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : String(input);
    let path = href;
    try {
      path = new URL(href).pathname;
    } catch {
      // keep the raw href
    }
    const key = keys.find((candidate) => path === candidate);
    const hit = key ? routes[key] : undefined;
    if (!hit) return new Response('', { status: 404 });
    return new Response(hit.body ?? '', { status: hit.status ?? 200 });
  });
}

function healthyRoutes(
  overrides: Record<string, { status?: number; body?: string }> = {},
) {
  return fetchMap({
    '/': { body: HOME_HTML },
    '/jobs': { body: JOB_HTML },
    '/companies/acme/jobs/eng': { body: JOB_HTML },
    '/sitemap.xml': { body: SITEMAP },
    '/robots.txt': { body: ROBOTS },
    '/ads.txt': { body: SEO.adsTxt },
    '/api/board-auth/oauth/google/callback': {
      status: 400,
      body: '{"error":"Missing code or state"}',
    },
    '/api/board-auth/oauth/linkedin/callback': {
      status: 400,
      body: '{"error":"Missing code or state"}',
    },
    '/indexnow-key.txt': { body: SEO.indexNowKey },
    ...overrides,
  });
}

const ENV = {
  apiUrl: 'https://api.example.com',
  boardKey: 'pk_tenant',
};

const BOARD_ROUTE = '/v1/boards/pk_tenant';

/** robots.txt in the fixtures advertises https://jobs.example.com/sitemap.xml */
const OWN_BOARD = {
  [BOARD_ROUTE]: { body: '{"primaryDomain":"jobs.example.com"}' },
};

describe('runReadProbes board identity', () => {
  // A frontend built with another tenant's key renders a complete, healthy
  // board and passes every other read probe. Only this one notices, because
  // robots.txt advertises the BOARD's canonical host, not the served host.
  it('warns when the advertised domain is not this board', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        [BOARD_ROUTE]: { body: '{"primaryDomain":"other-board.example"}' },
      }),
      'https://front.example',
      SEO,
      ENV,
    );

    const identity = results.find((r) => r.id === 'read.boardIdentity');
    // Warn, not fail: the same shape as a headless frontend on its own host.
    expect(identity?.status).toBe('warn');
    expect(identity?.detail).toContain('DIFFERENT board');
    expect(identity?.detail).toContain('CAVUNO_BOARD');
    // The point of the check: everything else looked fine.
    expect(results.find((r) => r.id === 'read.jobs')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.jsonld')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe('pass');
  });

  it('passes when the advertised domain is this board', async () => {
    const results = await runReadProbes(
      healthyRoutes(OWN_BOARD),
      'https://front.example',
      SEO,
      ENV,
    );

    expect(results.find((r) => r.id === 'read.boardIdentity')?.status).toBe(
      'pass',
    );
  });

  it('ignores a www. prefix on either side', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        [BOARD_ROUTE]: { body: '{"primaryDomain":"www.jobs.example.com"}' },
      }),
      'https://front.example',
      SEO,
      ENV,
    );

    expect(results.find((r) => r.id === 'read.boardIdentity')?.status).toBe(
      'pass',
    );
  });

  it('skips when the board endpoint cannot answer, rather than failing', async () => {
    const results = await runReadProbes(
      healthyRoutes({ [BOARD_ROUTE]: { status: 503, body: '{}' } }),
      'https://front.example',
      SEO,
      ENV,
    );

    expect(results.find((r) => r.id === 'read.boardIdentity')?.status).toBe(
      'skip',
    );
  });

  it('skips when robots.txt advertises no sitemap, and when env is absent', async () => {
    const noRobots = await runReadProbes(
      healthyRoutes({ ...OWN_BOARD, '/robots.txt': { body: 'User-agent: *' } }),
      'https://front.example',
      SEO,
      ENV,
    );
    expect(noRobots.find((r) => r.id === 'read.boardIdentity')?.status).toBe(
      'skip',
    );

    const noEnv = await runReadProbes(
      healthyRoutes(OWN_BOARD),
      'https://front.example',
      SEO,
    );
    expect(noEnv.find((r) => r.id === 'read.boardIdentity')?.status).toBe(
      'skip',
    );
  });
});

describe('runReadProbes SEO file probes', () => {
  it('passes when robots, ads.txt, IndexNow, and GSC match the snapshot', async () => {
    const home = `<html><head><meta name="google-site-verification" content="gsc-token"></head><body><div>home</div>
      <a href="/companies/acme/jobs/eng">Eng</a></body></html>`;
    const results = await runReadProbes(
      healthyRoutes({ '/': { body: home } }),
      'https://front.example',
      SEO,
    );

    expect(results.find((r) => r.id === 'read.robots')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.adsTxt')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.indexNow')?.status).toBe('pass');
    expect(
      results.find((r) => r.id === 'read.googleVerification')?.status,
    ).toBe('pass');
  });

  it('fails ads.txt / IndexNow when the served body does not match', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/ads.txt': { body: 'other-ads' },
        '/indexnow-key.txt': { body: 'other-key' },
      }),
      'https://front.example',
      SEO,
    );

    expect(results.find((r) => r.id === 'read.adsTxt')?.status).toBe('fail');
    expect(results.find((r) => r.id === 'read.indexNow')?.status).toBe('fail');
  });

  it('warns when ads.txt / IndexNow are served but the dashboard has none', async () => {
    const results = await runReadProbes(
      healthyRoutes(),
      'https://front.example',
      {
        ...SEO,
        adsTxt: null,
        indexNowKey: null,
      },
    );

    expect(results.find((r) => r.id === 'read.adsTxt')).toMatchObject({
      status: 'warn',
      detail: expect.stringContaining('clone leftover'),
    });
    expect(results.find((r) => r.id === 'read.indexNow')).toMatchObject({
      status: 'warn',
      detail: expect.stringContaining('clone leftover'),
    });
  });

  it('passes when unconfigured ads.txt / IndexNow 404', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/ads.txt': { status: 404, body: '' },
        '/indexnow-key.txt': { status: 404, body: '' },
      }),
      'https://front.example',
      { ...SEO, adsTxt: null, indexNowKey: null },
    );

    expect(results.find((r) => r.id === 'read.adsTxt')).toMatchObject({
      status: 'pass',
      detail: 'unconfigured; 404 as expected',
    });
    expect(results.find((r) => r.id === 'read.indexNow')).toMatchObject({
      status: 'pass',
      detail: 'unconfigured; 404 as expected',
    });
  });

  it('warns robots when the Sitemap line is missing', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/robots.txt': { body: 'User-agent: *\nDisallow: /go/\n' },
      }),
      'https://front.example',
      SEO,
    );

    const robots = results.find((r) => r.id === 'read.robots');
    expect(robots?.status).toBe('warn');
    expect(robots?.detail).toContain(
      'Sitemap: https://jobs.example.com/sitemap.xml',
    );
  });

  it('accepts GSC meta with reversed attributes and single quotes', async () => {
    const home = `<html><head><meta content='gsc-token' name='google-site-verification'></head><body><div>x</div></body></html>`;
    const results = await runReadProbes(
      healthyRoutes({ '/': { body: home } }),
      'https://front.example',
      SEO,
    );
    expect(
      results.find((r) => r.id === 'read.googleVerification')?.status,
    ).toBe('pass');
  });

  it('fails when the GSC token is configured but missing from home HTML', async () => {
    const results = await runReadProbes(
      healthyRoutes(),
      'https://front.example',
      SEO,
    );
    expect(
      results.find((r) => r.id === 'read.googleVerification')?.status,
    ).toBe('fail');
  });

  it('skips ads.txt, IndexNow, and GSC when seo was not fetched', async () => {
    const results = await runReadProbes(
      healthyRoutes(),
      'https://front.example',
      null,
    );

    expect(results.find((r) => r.id === 'read.adsTxt')).toMatchObject({
      status: 'skip',
      detail: 'board seo not fetched',
    });
    expect(results.find((r) => r.id === 'read.indexNow')).toMatchObject({
      status: 'skip',
      detail: 'board seo not fetched',
    });
    expect(
      results.find((r) => r.id === 'read.googleVerification'),
    ).toMatchObject({
      status: 'skip',
      detail: 'board seo not fetched',
    });
  });

  it('skips GSC when no token is configured', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/ads.txt': { status: 404 },
        '/indexnow-key.txt': { status: 404 },
      }),
      'https://front.example',
      { ...SEO, adsTxt: null, indexNowKey: null, googleSiteVerification: null },
    );
    expect(
      results.find((r) => r.id === 'read.googleVerification'),
    ).toMatchObject({
      status: 'skip',
      detail: 'no token configured',
    });
  });
});

describe('read.robots hard failures', () => {
  it('fails when /robots.txt is a 200 with no User-agent (SPA catch-all)', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/robots.txt': { body: '<html><body>app</body></html>' },
      }),
      'https://front.example',
      SEO,
    );
    const robots = results.find((r) => r.id === 'read.robots');
    expect(robots?.status).toBe('fail');
    expect(robots?.detail).toContain('no User-agent');
  });
});

describe('read.oauthCallback', () => {
  it('passes when the hosted callback answers a bare GET with 400', async () => {
    const results = await runReadProbes(
      healthyRoutes(),
      'https://board.test',
      SEO,
    );
    expect(results.find((r) => r.id === 'read.oauthCallback')?.status).toBe(
      'pass',
    );
  });

  it('warns when the frontend does not forward the callback path', async () => {
    const results = await runReadProbes(
      healthyRoutes({
        '/api/board-auth/oauth/linkedin/callback': { status: 404, body: '' },
      }),
      'https://board.test',
      SEO,
    );
    const result = results.find((r) => r.id === 'read.oauthCallback');
    expect(result?.status).toBe('warn');
    expect(result?.detail).toContain('linkedin/callback → HTTP 404');
    expect(result?.detail).toContain('cavuno.com/api/board-auth');
  });
});
