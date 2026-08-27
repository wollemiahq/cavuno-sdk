import { describe, expect, it } from 'vitest';

import {
  ADS_TXT_CACHE_CONTROL,
  adsTxtResponse,
  googleSiteVerificationMeta,
  INDEXNOW_CACHE_CONTROL,
  indexNowResponse,
  ROBOTS_CACHE_CONTROL,
  robotsBody,
  robotsResponse,
  SEO_FILE_CONTENT_TYPE,
} from './index';

const GOLDEN_ROBOTS = `User-Agent: *
Allow: /
Disallow: /go/
Disallow: /t/
Disallow: /jobs?page=
Disallow: /jobs*&page=
Disallow: /jobs/*?page=
Disallow: /companies?page=
Disallow: /companies*&page=
Disallow: /companies/*?page=
Disallow: /talent?page=
Disallow: /talent*&page=
Disallow: /talent/*?page=

Sitemap: https://jobs.example.com/sitemap.xml
`;

const SANDBOX_ROBOTS = `User-Agent: *
Disallow: /
`;

describe('robotsBody', () => {
  it('matches the hosted non-sandbox robots body byte for byte', () => {
    expect(robotsBody({ canonicalBase: 'https://jobs.example.com' })).toBe(
      GOLDEN_ROBOTS,
    );
  });

  it('strips a trailing slash from canonicalBase before the Sitemap line', () => {
    expect(robotsBody({ canonicalBase: 'https://jobs.example.com/' })).toBe(
      GOLDEN_ROBOTS,
    );
  });

  it('emits the sandbox body with no Sitemap', () => {
    expect(
      robotsBody({ canonicalBase: 'https://jobs.example.com', sandbox: true }),
    ).toBe(SANDBOX_ROBOTS);
    expect(
      robotsBody({ canonicalBase: 'https://jobs.example.com', sandbox: true }),
    ).not.toContain('Sitemap:');
  });
});

describe('robotsResponse', () => {
  it('serves the golden body with crawler cache headers', async () => {
    const res = robotsResponse({ canonicalBase: 'https://jobs.example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(SEO_FILE_CONTENT_TYPE);
    expect(res.headers.get('cache-control')).toBe(ROBOTS_CACHE_CONTROL);
    expect(await res.text()).toBe(GOLDEN_ROBOTS);
  });

  it('HEAD keeps status and headers with an empty body', async () => {
    const res = robotsResponse(
      { canonicalBase: 'https://jobs.example.com' },
      { method: 'HEAD' },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(SEO_FILE_CONTENT_TYPE);
    expect(res.headers.get('cache-control')).toBe(ROBOTS_CACHE_CONTROL);
    expect(await res.text()).toBe('');
  });
});

describe('adsTxtResponse / indexNowResponse polarity', () => {
  it('404s on null or empty ads.txt', async () => {
    const missing = adsTxtResponse({ adsTxt: null });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe('');

    const empty = adsTxtResponse({ adsTxt: '' });
    expect(empty.status).toBe(404);
  });

  it('404s on null or empty IndexNow key', async () => {
    expect(indexNowResponse({ indexNowKey: null }).status).toBe(404);
    expect(indexNowResponse({ indexNowKey: '' }).status).toBe(404);
  });

  it('serves configured ads.txt and IndexNow bodies', async () => {
    const ads = adsTxtResponse({
      adsTxt: 'google.com, pub-1, DIRECT, f08c47fec0942fa0\n',
    });
    expect(ads.status).toBe(200);
    expect(ads.headers.get('cache-control')).toBe(ADS_TXT_CACHE_CONTROL);
    expect(await ads.text()).toBe(
      'google.com, pub-1, DIRECT, f08c47fec0942fa0\n',
    );

    const key = indexNowResponse({ indexNowKey: 'abc123' });
    expect(key.status).toBe(200);
    expect(key.headers.get('cache-control')).toBe(INDEXNOW_CACHE_CONTROL);
    expect(await key.text()).toBe('abc123');
  });

  it('HEAD keeps ads.txt headers with an empty body', async () => {
    const res = adsTxtResponse(
      { adsTxt: 'google.com, pub-1, DIRECT, f08c47fec0942fa0\n' },
      { method: 'HEAD' },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(SEO_FILE_CONTENT_TYPE);
    expect(res.headers.get('cache-control')).toBe(ADS_TXT_CACHE_CONTROL);
    expect(await res.text()).toBe('');
  });
});

describe('googleSiteVerificationMeta', () => {
  it('returns null for null, empty, and whitespace-only tokens', () => {
    expect(googleSiteVerificationMeta(null)).toBe(null);
    expect(googleSiteVerificationMeta(undefined)).toBe(null);
    expect(googleSiteVerificationMeta('')).toBe(null);
    expect(googleSiteVerificationMeta('   ')).toBe(null);
  });

  it('trims a configured token into the meta descriptor', () => {
    expect(googleSiteVerificationMeta('  abc  ')).toEqual({
      name: 'google-site-verification',
      content: 'abc',
    });
  });
});
