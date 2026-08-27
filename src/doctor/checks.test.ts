import { describe, expect, it } from 'vitest';

import {
  checkEnv,
  extractJobDetailLink,
  extractJobPostingJsonLd,
  parseSitemap,
  summarize,
} from './checks';

describe('extractJobDetailLink', () => {
  it('matches the real detail shape and never a /jobs listing link', () => {
    const html =
      '<a href="/jobs/engineering">listing</a>' +
      '<a href="/companies/acme/jobs/senior-engineer">detail</a>';
    expect(extractJobDetailLink(html)).toBe(
      '/companies/acme/jobs/senior-engineer',
    );
    expect(extractJobDetailLink('<a href="/jobs/engineering">x</a>')).toBe(
      null,
    );
  });
});

describe('checkEnv (tier 1)', () => {
  it('passes with a well-formed api url and pk_ key', () => {
    const results = checkEnv({
      apiUrl: 'https://api.cavuno.com',
      boardKey: 'pk_0123456789abcdef0123456789abcdef', // gitleaks:allow
    });
    expect(results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('fails loudly on a missing key and a malformed key', () => {
    const missing = checkEnv({ apiUrl: 'https://api.cavuno.com' });
    expect(missing.some((r) => r.status === 'fail')).toBe(true);

    const malformed = checkEnv({
      apiUrl: 'https://api.cavuno.com',
      boardKey: 'sk_this-is-not-a-publishable-key',
    });
    expect(malformed.find((r) => r.id === 'env.board-key')?.status).toBe(
      'fail',
    );
  });

  it('fails on an unparseable api url', () => {
    const results = checkEnv({
      apiUrl: 'not a url',
      boardKey: 'pk_0123456789abcdef0123456789abcdef', // gitleaks:allow
    });
    expect(results.find((r) => r.id === 'env.api-url')?.status).toBe('fail');
  });
});

describe('extractJobPostingJsonLd (tier 2)', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Senior Backend Engineer","datePosted":"2026-07-01"}</script>
    <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
  </head><body></body></html>`;

  it('finds and parses the JobPosting block among multiple JSON-LD scripts', () => {
    const posting = extractJobPostingJsonLd(html);
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe('Senior Backend Engineer');
  });

  it('returns null when no JobPosting exists', () => {
    expect(
      extractJobPostingJsonLd(
        '<script type="application/ld+json">{"@type":"Article"}</script>',
      ),
    ).toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', () => {
    expect(
      extractJobPostingJsonLd(
        '<script type="application/ld+json">{"@type":"JobPosting",</script>',
      ),
    ).toBeNull();
  });
});

describe('parseSitemap (tier 2)', () => {
  it('reads <loc> entries from a urlset, typed as pages', () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://x.test/jobs</loc></url><url><loc>https://x.test/companies</loc></url></urlset>`;
    expect(parseSitemap(xml)).toEqual({
      kind: 'urlset',
      urls: ['https://x.test/jobs', 'https://x.test/companies'],
    });
  });

  it('reads child sitemaps from a sitemapindex, typed as an index', () => {
    const xml = `<sitemapindex><sitemap><loc>https://x.test/sitemap-jobs.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({
      kind: 'index',
      urls: ['https://x.test/sitemap-jobs.xml'],
    });
  });

  it('returns null for non-sitemap bodies', () => {
    expect(parseSitemap('<html>404</html>')).toBe(null);
  });
});

describe('summarize', () => {
  it('exit code reflects failures, and skips are surfaced not hidden', () => {
    const green = summarize([
      { id: 'a', tier: 1, status: 'pass', detail: '' },
      { id: 'b', tier: 2, status: 'skip', detail: 'frontend not provided' },
    ]);
    expect(green.exitCode).toBe(0);
    expect(green.skipped).toEqual(['b']);

    const red = summarize([
      { id: 'a', tier: 1, status: 'pass', detail: '' },
      { id: 'c', tier: 2, status: 'fail', detail: 'sitemap 404' },
    ]);
    expect(red.exitCode).toBe(1);
    expect(red.failed).toEqual(['c']);
  });

  it('counts warnings separately without failing the run', () => {
    const warned = summarize([
      { id: 'a', tier: 2, status: 'pass', detail: '' },
      { id: 'read.adsTxt', tier: 2, status: 'warn', detail: 'clone leftover' },
    ]);
    expect(warned.exitCode).toBe(0);
    expect(warned.warned).toEqual(['read.adsTxt']);
    expect(warned.failed).toEqual([]);
  });
});
