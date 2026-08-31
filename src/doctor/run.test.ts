import { describe, expect, it, vi } from 'vitest';

import { loadSkillCorpus } from '../skills';
import { runDoctor } from './run';

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Isolated project root so the skills check never reads the . */
const EMPTY_ROOT = mkdtempSync(join(tmpdir(), 'doctor-root-'));

const ENV = {
  apiUrl: 'https://api.cavuno.example',
  boardKey: 'pk_0123456789abcdef0123456789abcdef', // gitleaks:allow
};

// Real board link shape: job details live at /companies/{c}/jobs/{s} on
// BOTH hosted boards and the starter — /jobs/{x} is always a listing.
const JOB_HTML = `<html><body>
  <a href="/jobs/engineering">Engineering</a>
  <a href="/companies/technova/jobs/senior-backend-engineer">Senior Backend Engineer</a>
  <script type="application/ld+json">{"@type":"JobPosting","title":"Senior Backend Engineer"}</script>
</body></html>`;

function fetchStub(routes: Record<string, { status?: number; body?: string }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([suffix]) =>
      url.includes(suffix),
    );
    const { status = 200, body = '' } = match?.[1] ?? { status: 404 };
    return new Response(body, {
      status,
      headers: { 'content-type': 'text/html' },
    });
  });
}

describe('runDoctor tiers 1-2', () => {
  it('uses the production API when PUBLIC_CAVUNO_API_URL is omitted', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{"name":"Example board"}}' },
    });

    const { results } = await runDoctor({
      env: { boardKey: ENV.boardKey },
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(results.find((result) => result.id === 'env.api-url')).toMatchObject(
      {
        status: 'pass',
        detail: 'https://api.cavuno.com',
      },
    );
    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        'https://api.cavuno.com/v1/openapi.json',
        `https://api.cavuno.com/v1/boards/${ENV.boardKey}`,
      ]),
    );
  });

  it('all read probes pass against a healthy frontend', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{"name":"Example board"}}' },
      '/sitemap.xml': {
        body: '<urlset><url><loc>https://canonical-prod.example/jobs</loc></url></urlset>',
      },
      '/robots.txt': { body: 'User-agent: *\nDisallow: /go/\n' },
      '/companies/technova/jobs/senior-backend-engineer': { body: JOB_HTML },
      '/jobs': { body: JOB_HTML },
      'front.example': { body: JOB_HTML },
    });

    const { summary, results } = await runDoctor({
      env: ENV,
      frontendUrl: 'https://front.example',
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(summary.exitCode).toBe(0);
    expect(results.find((r) => r.id === 'read.jsonld')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe('pass');
    // Sitemap <loc>s carry the canonical production domain — the sample
    // probe must be rewritten onto the frontend under test, never fetch
    // the canonical host.
    const fetched = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(fetched.some((url) => url.includes('canonical-prod.example'))).toBe(
      false,
    );
    expect(fetched).toContain('https://front.example/jobs');
  });

  it('retries a 503 child sitemap once so a cold isolate can finish', async () => {
    let marketingHits = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/sitemap/marketing.xml')) {
        marketingHits += 1;
        if (marketingHits === 1) {
          return new Response('unavailable', { status: 503 });
        }
        return new Response(
          '<urlset><url><loc>https://front.example/</loc></url></urlset>',
          { status: 200 },
        );
      }
      if (url.endsWith('/sitemap.xml')) {
        return new Response(
          '<sitemapindex><sitemap><loc>https://front.example/sitemap/marketing.xml</loc></sitemap></sitemapindex>',
          { status: 200 },
        );
      }
      if (url.includes('/openapi.json')) {
        return new Response('{"openapi":"3.1.0"}', { status: 200 });
      }
      if (url.includes('/v1/boards/')) {
        return new Response('{"board":{"name":"Example board"}}', {
          status: 200,
        });
      }
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nDisallow: /go/\n', { status: 200 });
      }
      return new Response(JOB_HTML, { status: 200 });
    });

    const { results } = await runDoctor({
      env: ENV,
      frontendUrl: 'https://front.example',
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(marketingHits).toBe(2);
    expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe('pass');
  });

  it('fails loudly when the job page has no JobPosting JSON-LD', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{"name":"Example board"}}' },
      '/sitemap.xml': {
        body: '<urlset><url><loc>https://canonical-prod.example/jobs</loc></url></urlset>',
      },
      '/robots.txt': { body: 'ok' },
      '/companies/technova/jobs/senior-backend-engineer': {
        body: '<html><a href="/companies/x/jobs/y">j</a></html>',
      },
      'front.example': { body: JOB_HTML },
    });

    const { summary, results } = await runDoctor({
      env: ENV,
      frontendUrl: 'https://front.example',
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(results.find((r) => r.id === 'read.jsonld')?.status).toBe('fail');
    expect(summary.exitCode).toBe(1);
  });

  it('fails tier 1 when the board key does not resolve', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { status: 404, body: '{"error":{"code":"not_found"}}' },
    });

    const { results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });
    expect(results.find((r) => r.id === 'static.board')?.status).toBe('fail');
  });

  it('fails static.api on a 200 that is not an OpenAPI document (captive portal)', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '<html>Please contact your provider</html>' },
      '/v1/boards/': { body: '{"board":{}}' },
    });
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });
    expect(results.find((r) => r.id === 'static.api')?.status).toBe('fail');
  });

  it('runs the default API check but skips board resolution when the key is missing', async () => {
    const fetchImpl = fetchStub({});
    const { results } = await runDoctor({
      env: { apiUrl: undefined, boardKey: undefined },
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });
    expect(results.find((r) => r.id === 'static.api')?.status).toBe('fail');
    expect(results.find((r) => r.id === 'static.board')?.status).toBe('skip');
    expect(results.find((r) => r.id === 'static.skills')).toBeDefined();
  });

  it('skips the whole read tier (loudly) when no frontend url is given', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{"name":"Example board"}}' },
    });

    const { summary, results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    const readResults = results.filter((r) => r.tier === 2);
    expect(readResults.length).toBeGreaterThan(0);
    expect(readResults.every((r) => r.status === 'skip')).toBe(true);
    expect(summary.exitCode).toBe(0);
    expect(summary.skipped.length).toBeGreaterThan(0);
  });

  it('fails tier 1 when the API is unreachable', async () => {
    const fetchImpl = fetchStub({ '/openapi.json': { status: 503 } });

    const { summary, results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(results.find((r) => r.id === 'static.api')?.status).toBe('fail');
    expect(summary.exitCode).toBe(1);
  });

  it('preserves an /api path prefix in the API URL (mirrors BoardClient basePath)', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{"name":"Example board"}}' },
    });

    const { results } = await runDoctor({
      env: { ...ENV, apiUrl: 'https://cavuno.example/api' },
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    // The fetch stub matches by suffix, so pass/fail can't catch a dropped
    // prefix — assert on the exact URLs the doctor requested.
    const fetched = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(fetched).toContain(
      `https://cavuno.example/api/v1/boards/${ENV.boardKey}`,
    );
    expect(fetched).toContain('https://cavuno.example/api/v1/openapi.json');
    expect(
      fetched.some((url) => url.startsWith('https://cavuno.example/v1/')),
    ).toBe(false);
    expect(results.find((r) => r.id === 'static.board')?.status).toBe('pass');
  });
});

describe('static.skills freshness branches', () => {
  const okFetch = () =>
    fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{}}' },
    });

  function rootWithSkill(
    content: string,
    skillRoot: '.claude/skills' | '.cursor/skills' = '.claude/skills',
  ) {
    const root = mkdtempSync(join(tmpdir(), 'doctor-skills-'));
    const corpus = loadSkillCorpus();
    const skill = corpus.skills[0]!;
    const dir = join(root, skillRoot, skill.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content || skill.content);
    return { root, skill };
  }

  it('skips loudly when no skills are installed', async () => {
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl: okFetch(),
    });
    const skills = results.find((r) => r.id === 'static.skills');
    expect(skills?.status).toBe('skip');
    expect(skills?.detail).toContain('setup');
  });

  it('passes when installed skills match the package corpus', async () => {
    const { root } = rootWithSkill('');
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: root,
      fetchImpl: okFetch(),
    });
    expect(results.find((r) => r.id === 'static.skills')?.status).toBe('pass');
  });

  it('checks a matching skill installed for Cursor', async () => {
    const { root } = rootWithSkill('', '.cursor/skills');
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: root,
      fetchImpl: okFetch(),
    });
    expect(results.find((r) => r.id === 'static.skills')?.status).toBe('pass');
  });

  it('fails naming the stale skill when contents diverge', async () => {
    const { root, skill } = rootWithSkill('---\nstale copy\n---\n');
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: root,
      fetchImpl: okFetch(),
    });
    const skills = results.find((r) => r.id === 'static.skills');
    expect(skills?.status).toBe('fail');
    expect(skills?.detail).toContain(skill.name);
  });
});

describe('static.cookie-codec wiring', () => {
  it('appears in runDoctor tier-1 results', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{}}' },
    });
    const { results } = await runDoctor({
      env: ENV,
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });
    const cookie = results.find((r) => r.id === 'static.cookie-codec');
    expect(cookie).toBeDefined();
    expect(cookie?.tier).toBe(1);
    // EMPTY_ROOT has no src/ — loud skip, not a silent absence.
    expect(cookie?.status).toBe('skip');
  });
});

describe('static.analytics-surface wiring', () => {
  it('fails tier 1 when projectRoot contains a legacy analytics API', async () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-analytics-run-'));
    mkdirSync(join(root, 'app'));
    writeFileSync(
      join(root, 'app', 'analytics.ts'),
      'window.Tinybird?.trackEvent("page_view");\n',
    );
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{}}' },
    });

    const { results, summary } = await runDoctor({
      env: ENV,
      projectRoot: root,
      fetchImpl,
    });

    expect(
      results.find((result) => result.id === 'static.analytics-surface'),
    ).toMatchObject({ tier: 1, status: 'fail' });
    expect(summary.exitCode).toBe(1);
  });

  it('defaults the source scan to cwd when projectRoot is omitted', async () => {
    const fetchImpl = fetchStub({
      '/openapi.json': { body: '{"openapi":"3.1.0"}' },
      '/v1/boards/': { body: '{"board":{}}' },
    });
    const previousCwd = process.cwd();
    process.chdir(EMPTY_ROOT);
    try {
      const { results } = await runDoctor({ env: ENV, fetchImpl });

      const analytics = results.find(
        (result) => result.id === 'static.analytics-surface',
      );
      expect(analytics).toBeDefined();
      expect(analytics?.tier).toBe(1);
      expect(analytics?.status).toBe('skip');
    } finally {
      process.chdir(previousCwd);
    }
  });
});

describe('tier-2 SEO snapshot fetch', () => {
  it('probes /v1/boards/:key/seo after the board resolves and matches file bodies', async () => {
    const seo = {
      object: 'board_seo',
      canonicalBase: 'https://jobs.example.com',
      adsTxt: 'google.com, pub-1, DIRECT, f08c47fec0942fa0',
      indexNowKey: 'idx-key',
      googleSiteVerification: 'gsc-token',
      manifest: { name: 'Example' },
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/openapi.json')) {
        return new Response('{"openapi":"3.1.0"}', { status: 200 });
      }
      if (url.endsWith('/seo')) {
        return new Response(JSON.stringify(seo), { status: 200 });
      }
      if (url.includes('/v1/boards/')) {
        return new Response('{"board":{"name":"Example board"}}', {
          status: 200,
        });
      }
      if (url.endsWith('/robots.txt')) {
        return new Response(
          `User-agent: *\nDisallow: /go/\nSitemap: ${seo.canonicalBase}/sitemap.xml\n`,
          { status: 200 },
        );
      }
      if (url.endsWith('/ads.txt')) {
        return new Response(seo.adsTxt, { status: 200 });
      }
      if (url.endsWith('/indexnow-key.txt')) {
        return new Response(seo.indexNowKey, { status: 200 });
      }
      if (url.endsWith('/sitemap.xml')) {
        return new Response(
          '<urlset><url><loc>https://front.example/jobs</loc></url></urlset>',
          { status: 200 },
        );
      }
      const home = `<html><head><meta name="google-site-verification" content="gsc-token"></head><body>
        <a href="/companies/technova/jobs/senior-backend-engineer">j</a>
        <script type="application/ld+json">{"@type":"JobPosting","title":"Senior Backend Engineer"}</script>
      </body></html>`;
      return new Response(home, { status: 200 });
    });

    const { results, summary } = await runDoctor({
      env: ENV,
      frontendUrl: 'https://front.example',
      projectRoot: EMPTY_ROOT,
      fetchImpl,
    });

    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        `https://api.cavuno.example/v1/boards/${ENV.boardKey}/seo`,
      ]),
    );
    expect(results.find((r) => r.id === 'read.adsTxt')?.status).toBe('pass');
    expect(results.find((r) => r.id === 'read.indexNow')?.status).toBe('pass');
    expect(
      results.find((r) => r.id === 'read.googleVerification')?.status,
    ).toBe('pass');
    expect(summary.exitCode).toBe(0);
  });
});
