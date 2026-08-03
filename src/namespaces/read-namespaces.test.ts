import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createBoardClient } from '../index';

import type {
  PublicTaxonomyTerm,
  SuggestionsListQuery,
  TaxonomyListQuery,
} from '../index';
import type { PublicBoard } from '../types/board';
import type { PublicJob } from '../types/jobs';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(body: unknown = { object: 'list', data: [] }) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    jsonResponse(body),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function makeBoard() {
  return createBoardClient({
    baseUrl: 'https://api.cavuno.com',
    board: 'acme-jobs',
  });
}

function sentUrl(spy: ReturnType<typeof stubFetch>, call = 0) {
  return spy.mock.calls[call]![0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

describe('board.context()', () => {
  it('GETs the bare board root', async () => {
    const context: PublicBoard = {
      object: 'public_board',
      id: 'boards_abc',
      slug: 'acme-jobs',
      name: 'Acme Jobs',
      language: 'en',
      logoUrl: null,
      primaryDomain: null,
      showCavunoBranding: true,
      features: {
        jobAlerts: true,
        candidates: true,
        employers: true,
        blog: true,
        talentDirectory: false,
        registrationWall: false,
        passwordProtected: false,
        publicJobSubmission: false,
        candidatePaywall: false,
        impressum: false,
        nativeApplications: true,
        messaging: true,
      },
      talentDirectoryVisibility: 'off',
      analytics: {
        ga4MeasurementId: null,
        gtmId: null,
        metaPixelId: null,
        linkedInPartnerId: null,
        cookieConsentRequired: false,
      },
      // Custom-field definitions pass through untouched so the
      // consumer can resolve a job's `customFieldValues` keys → labels.
      customFields: [
        {
          key: 'security_clearance',
          label: 'Security clearance',
          type: 'single_select',
          options: [
            { key: 'ts_sci', label: 'TS/SCI' },
            { key: 'none', label: 'None' },
          ],
          required: false,
        },
      ],
      labels: {},
      footer: {
        description: null,
        contactEmail: null,
        websiteUrl: null,
        xUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
        navigationOrder: [],
        customLinks: [],
      },
    };
    const spy = stubFetch(context);
    const board = makeBoard();
    const result = await board.context();
    expect(sentUrl(spy)).toBe(BASE);
    expect(result).toEqual(context);
    // The definitions survive the pass-through byte-for-byte.
    expect(result.customFields).toEqual(context.customFields);
  });
});

describe('board.seo()', () => {
  it('GETs /seo and passes the SEO payload through untouched', async () => {
    const seo = {
      object: 'board_seo' as const,
      adsTxt: 'google.com, pub-1, DIRECT',
      indexNowKey: 'k',
      googleSiteVerification: 'g',
      canonicalBase: 'https://acme.cavuno.com',
      icons: {
        ico: 'https://cdn/a.ico',
        svg: null,
        appleTouch: null,
        icon192: 'https://cdn/192.png',
        icon512: null,
        iconMaskable512: null,
      },
      manifest: { name: 'Acme Jobs', themeColor: '#1d4ed8' },
    };
    const spy = stubFetch(seo);
    const result = await makeBoard().seo();
    expect(sentUrl(spy)).toBe(`${BASE}/seo`);
    expect(result).toEqual(seo);
  });
});

describe('board.redirects.resolve()', () => {
  it('GETs /redirects/resolve?path= (URL-encoded) and passes the resolution through', async () => {
    const body = {
      object: 'redirect_resolution' as const,
      path: '/old-jobs',
      target: '/jobs',
    };
    const spy = stubFetch(body);
    const result = await makeBoard().redirects.resolve('/old-jobs');
    expect(sentUrl(spy)).toBe(`${BASE}/redirects/resolve?path=%2Fold-jobs`);
    expect(result).toEqual(body);
  });
});

describe('board.legal.retrieve()', () => {
  it('GETs /legal/:type and passes the legal page through untouched', async () => {
    const body = {
      object: 'legal_page' as const,
      type: 'impressum',
      title: 'Impressum',
      content: '<p>Angaben gemäß §5 TMG</p>',
      contentFormat: 'html' as const,
      legalEntity: { legalName: 'Acme GmbH', address: 'Berlin' },
    };
    const spy = stubFetch(body);
    const result = await makeBoard().legal.retrieve('impressum');
    expect(sentUrl(spy)).toBe(`${BASE}/legal/impressum`);
    expect(result).toEqual(body);
  });
});

describe('board.jobs', () => {
  it('list passes flat query params', async () => {
    const spy = stubFetch();
    await makeBoard().jobs.list({
      cursor: 'c1',
      limit: 10,
      companyId: ['companies_x'],
      remoteOption: ['remote'],
      employmentType: ['full_time'],
      seniority: ['senior'],
    });
    expect(sentUrl(spy)).toBe(
      `${BASE}/jobs?cursor=c1&limit=10&companyId=companies_x&remoteOption=remote&employmentType=full_time&seniority=senior`,
    );
  });

  it('retrieve URL-encodes the job slug', async () => {
    const spy = stubFetch({ object: 'public_job' });
    await makeBoard().jobs.retrieve('senior chef/zürich');
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/senior%20chef%2Fz%C3%BCrich`);
  });

  it('retrieve passes the opaque customFieldValues bag through untouched', async () => {
    const customFieldValues: PublicJob['customFieldValues'] = {
      security_clearance: 'ts_sci',
      benefits: ['health', 'dental'],
      remote_ok: true,
      team_size: 12,
    };
    const spy = stubFetch({ object: 'public_job', customFieldValues });
    const result = await makeBoard().jobs.retrieve('senior-engineer');
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/senior-engineer`);
    // Raw keys + values survive verbatim — the SDK never resolves or reshapes.
    expect(result.customFieldValues).toEqual(customFieldValues);
  });

  it('similar GETs the per-job rail URL with the limit query', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await makeBoard().jobs.similar('senior chef/zürich', { limit: 5 });
    expect(sentUrl(spy)).toBe(
      `${BASE}/jobs/senior%20chef%2Fz%C3%BCrich/similar?limit=5`,
    );
  });

  it('similar passes the list envelope through untouched', async () => {
    const body = {
      object: 'list',
      url: '/v1/boards/acme-jobs/jobs/senior-chef/similar',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          id: 'jobs_2',
          object: 'job_card',
          slug: 'pastry-chef',
          title: 'Pastry Chef',
          publishedAt: '2026-01-01T00:00:00.000Z',
          employmentType: 'full_time',
          remoteOption: 'on_site',
          remoteLocationLabel: null,
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          salaryTimeframe: null,
          isFeatured: false,
          locationLabel: 'Zürich',
          company: { slug: 'acme', name: 'Acme', logoUrl: null },
          categories: [{ slug: 'culinary', name: 'Culinary' }],
          skills: [{ slug: 'baking', name: 'Baking' }],
          links: { public: null },
        },
      ],
    };
    stubFetch(body);
    const result = await makeBoard().jobs.similar('senior-chef');
    expect(result).toEqual(body);
  });

  it('search POSTs the body with filters', async () => {
    const spy = stubFetch({ object: 'search_result', data: [] });
    await makeBoard().jobs.search({
      query: 'chef',
      filters: {
        seniority: ['senior', 'lead'],
        publishedAt: { gte: '2026-01-01T00:00:00.000Z' },
      },
      limit: 5,
    });
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/search`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(JSON.parse(spy.mock.calls[0]![1]!.body as string)).toEqual({
      query: 'chef',
      filters: {
        seniority: ['senior', 'lead'],
        publishedAt: { gte: '2026-01-01T00:00:00.000Z' },
      },
      limit: 5,
    });
  });
});

describe('board.companies', () => {
  it('list, retrieve, search, and listJobs hit their routes', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.companies.list({ limit: 5 });
    await board.companies.retrieve('acme');
    await board.companies.search({ query: 'acme' });
    await board.companies.listJobs('acme', { cursor: 'c2' });
    await board.companies.similar('acme', { limit: 6 });
    await board.companies.markets({ limit: 50, search: 'robo' });
    expect(sentUrl(spy, 0)).toBe(`${BASE}/companies?limit=5`);
    expect(sentUrl(spy, 1)).toBe(`${BASE}/companies/acme`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/companies/search`);
    expect(spy.mock.calls[2]![1]!.method).toBe('POST');
    expect(sentUrl(spy, 3)).toBe(`${BASE}/companies/acme/jobs?cursor=c2`);
    expect(sentUrl(spy, 4)).toBe(`${BASE}/companies/acme/similar?limit=6`);
    expect(sentUrl(spy, 5)).toBe(
      `${BASE}/companies/markets?limit=50&search=robo`,
    );
  });

  it('marketSlug filter + markets.resolve hit their routes', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.companies.list({ marketSlug: 'cybersecurity', limit: 5 });
    await board.companies.search({
      query: 'pentest',
      marketSlug: 'cybersecurity',
    });
    await board.companies.markets.resolve('cybersecurity');
    expect(sentUrl(spy, 0)).toContain('marketSlug=cybersecurity');
    expect(sentUrl(spy, 0)).toContain('limit=5');
    expect(sentUrl(spy, 1)).toBe(`${BASE}/companies/search`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/companies/markets/cybersecurity`);
  });

  it('passes the detail markets, list relatedSearches, and market resolution through unchanged', async () => {
    // retrieve → detail with markets, byte-identical
    const detail = {
      object: 'public_company',
      id: 'p1',
      name: 'Booz Allen Hamilton',
      slug: 'booz-allen-hamilton',
      website: 'https://boozallen.com/',
      logoUrl: null,
      description: null,
      jobCount: 14,
      publishedJobCount: 14,
      links: { public: null },
      markets: [{ name: 'Cybersecurity', slug: 'cybersecurity' }],
    };
    stubFetch(detail);
    expect(await makeBoard().companies.retrieve('booz-allen-hamilton')).toEqual(
      detail,
    );

    // list → carries the `market` relatedSearches rail, byte-identical
    const list = {
      object: 'list',
      url: '/v1/boards/acme-jobs/companies',
      hasMore: false,
      nextCursor: null,
      data: [],
      relatedSearches: [
        {
          type: 'market',
          slug: 'cybersecurity',
          term: 'Cybersecurity',
          count: 2,
        },
      ],
    };
    stubFetch(list);
    expect(await makeBoard().companies.list()).toEqual(list);

    // markets.resolve → the taxonomy resolution, byte-identical
    const resolution = {
      object: 'taxonomy_resolution',
      type: 'market',
      sourceSlug: 'cybersecurity',
      canonicalSlug: 'cybersicherheit',
      displayName: 'Cybersicherheit',
      redirectTo: 'cybersicherheit',
      geo: null,
    };
    stubFetch(resolution);
    expect(
      await makeBoard().companies.markets.resolve('cybersecurity'),
    ).toEqual(resolution);
  });

  it('salaries(slug) + salaries.category(slug, cat) hit their routes', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.companies.salaries('acme');
    await board.companies.salaries.category('acme', 'software-engineer', {
      locale: 'de',
    });
    expect(sentUrl(spy, 0)).toBe(`${BASE}/companies/acme/salaries`);
    expect(sentUrl(spy, 1)).toBe(
      `${BASE}/companies/acme/salaries/software-engineer?locale=de`,
    );
  });

  it('passes the company-salary overview + category through unchanged', async () => {
    const overview = {
      object: 'company_salary',
      companyName: 'Acme',
      companySlug: 'acme',
      companyLogoPath: null,
      companyWebsite: null,
      overallSalary: { avgMin: 120000, avgMax: 180000, jobCount: 50 },
      bySeniority: [],
      competitors: [],
      topLocations: [],
      byCategory: [],
      boardOverallAvgMin: null,
      boardOverallAvgMax: null,
      boardMedianMin: null,
      boardMedianMax: null,
      boardP25Min: null,
      boardP75Min: null,
      boardP25Max: null,
      boardP75Max: null,
      currency: 'USD',
    };
    stubFetch(overview);
    expect(await makeBoard().companies.salaries('acme')).toEqual(overview);

    const category = {
      object: 'company_category_salary',
      categorySourceSlug: 'software-engineer',
      categoryCanonicalSlug: 'softwareentwickler',
      companyName: 'Acme',
      companySlug: 'acme',
      companyLogoPath: null,
      companyWebsite: null,
      categoryName: 'Softwareentwickler',
      overallSalary: null,
      bySeniority: [],
      competitors: [],
      boardCategoryAvgMin: null,
      boardCategoryAvgMax: null,
      boardCategoryP25Min: null,
      boardCategoryP75Max: null,
      currency: 'USD',
    };
    stubFetch(category);
    expect(
      await makeBoard().companies.salaries.category(
        'acme',
        'softwareentwickler',
        { locale: 'de' },
      ),
    ).toEqual(category);
  });
});

describe('board.blog', () => {
  it('posts, tags, authors, adjacent, similar, and search hit their routes', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    await board.blog.posts.list({ tagSlug: 'news', featured: 'true' });
    await board.blog.posts.retrieve('hello-world');
    await board.blog.posts.adjacent('hello-world');
    await board.blog.posts.similar('hello-world', { limit: 6 });
    await board.blog.tags.list();
    await board.blog.tags.retrieve('news');
    await board.blog.authors.list();
    await board.blog.authors.retrieve('jane');
    await board.blog.search({ query: 'launch' });
    expect(sentUrl(spy, 0)).toBe(
      `${BASE}/blog/posts?tagSlug=news&featured=true`,
    );
    expect(sentUrl(spy, 1)).toBe(`${BASE}/blog/posts/hello-world`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/blog/posts/hello-world/adjacent`);
    expect(sentUrl(spy, 3)).toBe(
      `${BASE}/blog/posts/hello-world/similar?limit=6`,
    );
    expect(sentUrl(spy, 4)).toBe(`${BASE}/blog/tags`);
    expect(sentUrl(spy, 5)).toBe(`${BASE}/blog/tags/news`);
    expect(sentUrl(spy, 6)).toBe(`${BASE}/blog/authors`);
    expect(sentUrl(spy, 7)).toBe(`${BASE}/blog/authors/jane`);
    expect(sentUrl(spy, 8)).toBe(`${BASE}/blog/search`);
    expect(spy.mock.calls[8]![1]!.method).toBe('POST');
  });

  it('posts.retrieve passes the slug-history redirect signal through untouched', async () => {
    const body = {
      object: 'public_blog_post',
      id: 'blogposts_1',
      slug: 'new-slug',
      featureImageAlt: 'cover alt',
      redirected: true,
      newSlug: 'new-slug',
      html: '<p>Body</p>',
    };
    stubFetch(body);
    const result = await makeBoard().blog.posts.retrieve('old-slug');
    expect(result.redirected).toBe(true);
    expect(result.newSlug).toBe('new-slug');
    expect(result.featureImageAlt).toBe('cover alt');
  });

  it('posts.adjacent passes the previous/next pair through untouched', async () => {
    const body = {
      object: 'blog_adjacent_posts',
      previous: { object: 'public_blog_post', slug: 'older' },
      next: null,
    };
    stubFetch(body);
    const result = await makeBoard().blog.posts.adjacent('current');
    expect(result.object).toBe('blog_adjacent_posts');
    expect(result.previous?.slug).toBe('older');
    expect(result.next).toBeNull();
  });
});

describe('method conventions', () => {
  it('trailing options (headers, signal) are forwarded on list, retrieve, and search shapes', async () => {
    const spy = stubFetch();
    const board = makeBoard();
    const controller = new AbortController();
    await board.jobs.list(
      { limit: 1 },
      { headers: { 'x-locale': 'de' }, signal: controller.signal },
    );
    await board.jobs.retrieve('a-slug', undefined, {
      headers: { 'x-locale': 'fr' },
    });
    await board.jobs.search({ query: 'x' }, undefined, {
      headers: { 'x-locale': 'it' },
    });
    expect((spy.mock.calls[0]![1]!.headers as Headers).get('x-locale')).toBe(
      'de',
    );
    expect(spy.mock.calls[0]![1]!.signal).toBe(controller.signal);
    expect((spy.mock.calls[1]![1]!.headers as Headers).get('x-locale')).toBe(
      'fr',
    );
    expect((spy.mock.calls[2]![1]!.headers as Headers).get('x-locale')).toBe(
      'it',
    );
  });

  it('board.client.fetch is public and routes through the full pipeline', async () => {
    const spy = stubFetch({ ok: true });
    const board = makeBoard();
    await board.client.fetch('/custom/stats', { method: 'POST', body: {} });
    expect(sentUrl(spy)).toBe(`${BASE}/custom/stats`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('x-cavuno-sdk')).toMatch(/^board@/);
  });

  it('a response fixture transcribed from the serializer satisfies PublicJob', () => {
    // Compile-time transcription check — assignment fails the typecheck
    // if the hand-written type drifts from the serializer shape.
    const fixture: PublicJob = {
      id: 'jobs_1',
      object: 'public_job',
      title: 'Chef',
      slug: 'chef',
      status: 'published',
      companyId: 'companies_1',
      employmentType: 'full_time',
      remoteOption: 'remote',
      seniority: 'senior',
      salaryMin: 1,
      salaryMax: 2,
      salaryCurrency: 'EUR',
      salaryTimeframe: 'per_year',
      isFeatured: false,
      publishedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      description: null,
      applicationUrl: null,
      remotePermits: [{ type: 'country', value: 'DE' }],
      remoteWorldwide: false,
      remoteTimezones: [{ type: 'utc_offset', value: '+2', plusMinus: 2 }],
      remoteAllowedTzOffsets: [2],
      remoteWorkPermitCountryCodes: ['DE'],
      remoteWorkPermitSubdivisionCodes: [],
      remoteSponsorship: 'unknown',
      educationRequirements: ['bachelor_degree'],
      experienceMonths: null,
      experienceInPlaceOfEducation: null,
      inOfficePeriod: null,
      inOfficeFrequency: null,
      company: {
        id: 'companies_1',
        name: 'Acme',
        slug: 'acme',
        logoUrl: null,
        website: null,
      },
      officeLocations: [
        {
          countryCode: 'DE',
          country: 'Germany',
          locality: null,
          city: 'Berlin',
          region: null,
          regionCode: null,
          postalCode: null,
          displayName: 'Berlin, Germany',
        },
      ],
      categories: [{ slug: 'engineering', name: 'Engineering' }],
      skills: [{ slug: 'typescript', name: 'TypeScript' }],
      placeHierarchy: [{ slug: 'germany', name: 'Germany' }],
      customFieldValues: { security_clearance: 'ts_sci', team_size: 12 },
      links: { public: null },
    };
    expect(fixture.object).toBe('public_job');
  });

  it('jobs.retrieve passes resolved taxonomy + placeHierarchy through untouched', async () => {
    const body = {
      object: 'public_job',
      id: 'jobs_1',
      slug: 'chef',
      categories: [{ slug: 'culinary', name: 'Culinary' }],
      skills: [{ slug: 'baking', name: 'Baking' }],
      placeHierarchy: [
        { slug: 'united-states', name: 'United States' },
        { slug: 'california-united-states', name: 'California' },
      ],
    };
    stubFetch(body);
    const result = await makeBoard().jobs.retrieve('chef');
    expect(result.categories).toEqual([{ slug: 'culinary', name: 'Culinary' }]);
    expect(result.skills).toEqual([{ slug: 'baking', name: 'Baking' }]);
    expect(result.placeHierarchy).toEqual([
      { slug: 'united-states', name: 'United States' },
      { slug: 'california-united-states', name: 'California' },
    ]);
  });
});

describe('board.salaries', () => {
  it('titles/skills/locations retrieve hit their routes, forwarding locale', async () => {
    const spy = stubFetch({});
    const board = makeBoard();

    await board.salaries.titles.retrieve('software-engineer');
    await board.salaries.skills.retrieve('python', { locale: 'de' });
    await board.salaries.locations.retrieve('berlin', { locale: 'de' });

    expect(sentUrl(spy, 0)).toBe(`${BASE}/salaries/titles/software-engineer`);
    expect(spy.mock.calls[0]![1]!.method).toBe('GET');
    expect(sentUrl(spy, 1)).toBe(`${BASE}/salaries/skills/python?locale=de`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/salaries/locations/berlin?locale=de`);
  });

  it('encodes slugs and never mangles the body', async () => {
    const spy = stubFetch({});
    await makeBoard().salaries.titles.retrieve('c++ developer');
    expect(sentUrl(spy, 0)).toBe(`${BASE}/salaries/titles/c%2B%2B%20developer`);
  });

  it('passes the title detail through unchanged (no SDK reshaping)', async () => {
    // Exact shape of the route serializer (`serializeTitleSalaryDetail`).
    const detail = {
      object: 'title_salary_detail',
      sourceSlug: 'software-engineer',
      canonicalSlug: 'softwareentwickler',
      categoryName: 'Software Engineer',
      overallSalary: {
        avgMin: 90000,
        avgMax: 140000,
        p25Min: 80000,
        p75Max: 150000,
        jobCount: 120,
      },
      bySeniority: [
        {
          seniority: 'senior',
          avgSalaryMin: 120000,
          avgSalaryMax: 170000,
          jobCount: 50,
          boardAvgMin: 115000,
          boardAvgMax: 165000,
          boardMedianMin: 118000,
          boardMedianMax: 160000,
          boardP25Min: 105000,
          boardP75Min: 120000,
          boardP25Max: 150000,
          boardP75Max: 175000,
          diffPercent: 4,
        },
      ],
      topCompanies: [
        {
          companySlug: 'acme',
          companyName: 'Acme',
          logoPath: null,
          avgSalaryMin: 100000,
          avgSalaryMax: 150000,
          jobCount: 30,
        },
      ],
      topLocations: [
        {
          placeName: 'Berlin',
          placeSlug: 'berlin',
          countryCode: 'DE',
          avgSalaryMin: 85000,
          avgSalaryMax: 130000,
          jobCount: 25,
        },
      ],
      topSkills: [
        {
          skillSlug: 'python',
          skillName: 'Python',
          avgSalaryMin: 95000,
          avgSalaryMax: 140000,
          jobCount: 80,
        },
      ],
      relatedTitles: [
        {
          categorySlug: 'data-scientist',
          categoryName: 'Data Scientist',
          avgSalaryMin: 100000,
          avgSalaryMax: 150000,
          jobCount: 70,
        },
      ],
      totalLocationCount: 5,
      boardOverallAvgMin: 115000,
      boardOverallAvgMax: 165000,
      boardMedianMin: 118000,
      boardMedianMax: 160000,
      boardP25Min: 105000,
      boardP75Max: 175000,
      currency: 'USD',
    };
    stubFetch(detail);
    expect(
      await makeBoard().salaries.titles.retrieve('software-engineer'),
    ).toEqual(detail);
  });

  it('the four index lists hit their hub routes, forwarding locale', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.salaries.companies.list();
    await board.salaries.titles.list({ locale: 'de' });
    await board.salaries.skills.list();
    await board.salaries.locations.list({ locale: 'de' });

    expect(sentUrl(spy, 0)).toBe(`${BASE}/salaries/companies`);
    expect(spy.mock.calls[0]![1]?.method ?? 'GET').toBe('GET');
    expect(sentUrl(spy, 1)).toBe(`${BASE}/salaries/titles?locale=de`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/salaries/skills`);
    expect(sentUrl(spy, 3)).toBe(`${BASE}/salaries/locations?locale=de`);
  });

  it('passes the location index (flattened tree) through unchanged', async () => {
    const body = {
      object: 'list',
      url: '/v1/boards/acme-jobs/salaries/locations',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          object: 'salary_location',
          placeSlug: 'united-states',
          placeName: 'United States',
          parentSlug: null,
          avgSalaryMin: 120000,
          avgSalaryMax: 180000,
          jobCount: 100,
        },
        {
          object: 'salary_location',
          placeSlug: 'california-united-states',
          placeName: 'California',
          parentSlug: 'united-states',
          avgSalaryMin: 130000,
          avgSalaryMax: 190000,
          jobCount: 60,
        },
      ],
    };
    stubFetch(body);
    expect(await makeBoard().salaries.locations.list()).toEqual(body);
  });

  it('the six cross-axis methods hit their routes, forwarding locale + encoding slugs', async () => {
    const spy = stubFetch({});
    const board = makeBoard();

    await board.salaries.titles.locations('software-engineer', {
      locale: 'de',
    });
    await board.salaries.titles.location('software-engineer', 'berlin');
    await board.salaries.skills.locations('python');
    await board.salaries.skills.location('c++', 'berlin', { locale: 'de' });
    await board.salaries.locations.titles('berlin');
    await board.salaries.locations.skills('berlin', { locale: 'de' });

    expect(sentUrl(spy, 0)).toBe(
      `${BASE}/salaries/titles/software-engineer/locations?locale=de`,
    );
    expect(sentUrl(spy, 1)).toBe(
      `${BASE}/salaries/titles/software-engineer/berlin`,
    );
    expect(sentUrl(spy, 2)).toBe(`${BASE}/salaries/skills/python/locations`);
    expect(sentUrl(spy, 3)).toBe(
      `${BASE}/salaries/skills/c%2B%2B/berlin?locale=de`,
    );
    expect(sentUrl(spy, 4)).toBe(`${BASE}/salaries/locations/berlin/titles`);
    expect(sentUrl(spy, 5)).toBe(
      `${BASE}/salaries/locations/berlin/skills?locale=de`,
    );
  });
});

describe('board.talent', () => {
  it('list + retrieve hit their routes, forwarding q/skill/limit + encoding the handle', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.talent.list({ q: 'eng', skill: 'react', limit: 5 });
    await board.talent.retrieve('jane doe/zürich');

    expect(sentUrl(spy, 0)).toBe(`${BASE}/talent?q=eng&skill=react&limit=5`);
    expect(spy.mock.calls[0]![1]?.method ?? 'GET').toBe('GET');
    expect(sentUrl(spy, 1)).toBe(`${BASE}/talent/jane%20doe%2Fz%C3%BCrich`);
  });

  it('passes the profile + directory list through unchanged', async () => {
    const profile = {
      object: 'talent_profile',
      handle: 'jane',
      displayName: 'Jane Doe',
      headline: 'Staff Engineer',
      location: 'Berlin',
      bio: 'Hi',
      avatarUrl: null,
      jobSearchStatus: 'actively_looking',
      experiences: [],
      education: [],
      skills: [{ name: 'React', jobSkillId: null }],
      languages: [{ name: 'English', proficiency: 'native_or_bilingual' }],
    };
    stubFetch(profile);
    expect(await makeBoard().talent.retrieve('jane')).toEqual(profile);

    const list = {
      object: 'list',
      url: '/v1/boards/acme-jobs/talent',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          object: 'talent_directory_entry',
          handle: 'jane',
          displayName: 'Jane Doe',
          headline: 'Staff Engineer',
          location: 'Berlin',
          avatarUrl: null,
          bio: 'Hi',
          jobSearchStatus: 'actively_looking',
          skills: ['React'],
          experiences: [],
          education: [],
        },
      ],
    };
    stubFetch(list);
    expect(await makeBoard().talent.list()).toEqual(list);
  });
});

describe('board.paywall', () => {
  it('offers GETs the public enabled-offers route', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.paywall.offers();

    expect(sentUrl(spy, 0)).toBe(`${BASE}/paywall/offers/enabled`);
    expect(spy.mock.calls[0]![1]?.method).toBe('GET');
  });
});

describe('board.plans', () => {
  it('list (with purpose) + salesLed hit their routes', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.plans.list({ purpose: 'talent_access' });
    await board.plans.list();
    await board.plans.salesLed();

    expect(sentUrl(spy, 0)).toBe(`${BASE}/plans?purpose=talent_access`);
    expect(sentUrl(spy, 1)).toBe(`${BASE}/plans`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/sales-led-plans`);
  });

  it('passes the plan + sales-led lists through unchanged', async () => {
    const plans = {
      object: 'list',
      url: '/v1/boards/acme-jobs/plans',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          object: 'plan',
          id: 'p1',
          name: 'Starter',
          description: null,
          purpose: 'job_posting',
          kind: 'subscription',
          billingInterval: 'month',
          isRecommended: true,
          displayOrder: 0,
          invoiceOnly: false,
          publishTiming: 'on_payment',
          netTermsDays: null,
          price: {
            currency: 'usd',
            amountCents: 4900,
            stripePriceId: 'price_x',
          },
          featureSummary: {
            durationDays: 30,
            maxActiveJobs: 5,
            featuredSlots: 1,
            featureSelectionMode: 'manual',
          },
        },
        {
          object: 'plan',
          id: 'p2',
          name: 'Talent',
          description: null,
          purpose: 'talent_access',
          kind: 'subscription',
          billingInterval: 'month',
          isRecommended: false,
          displayOrder: 1,
          invoiceOnly: false,
          publishTiming: null,
          netTermsDays: null,
          price: {
            currency: 'usd',
            amountCents: 9900,
            stripePriceId: 'price_t',
          },
          featureSummary: {
            durationDays: 30,
            maxActiveJobs: 1,
            featuredSlots: 0,
            featureSelectionMode: 'auto',
          },
          talent: { unlocksPerPeriod: '25', messagesPerPeriod: 'unlimited' },
        },
      ],
    };
    stubFetch(plans);
    expect(await makeBoard().plans.list()).toEqual(plans);

    const salesLed = {
      object: 'list',
      url: '/v1/boards/acme-jobs/sales-led-plans',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          object: 'sales_led_plan',
          id: 's1',
          name: 'Enterprise',
          description: 'Custom volume hiring',
          priceText: 'Contact us',
          ctaText: 'Talk to sales',
          ctaDestination: 'mailto:sales@acme.com',
          featuredBullets: ['Unlimited jobs'],
          displayOrder: 0,
        },
      ],
    };
    stubFetch(salesLed);
    expect(await makeBoard().plans.salesLed()).toEqual(salesLed);
  });
});

describe('board.search', () => {
  it('suggest GETs /search/suggest with the query params', async () => {
    const spy = stubFetch({
      object: 'suggest_result',
      query: 'acme',
      items: [],
    });
    const board = makeBoard();

    await board.search.suggest({ q: 'acme', limit: 10 });

    expect(sentUrl(spy, 0)).toBe(`${BASE}/search/suggest?q=acme&limit=10`);
  });
});

describe('board.taxonomy', () => {
  it('exports the collection request and response types from the package root', () => {
    expectTypeOf<PublicTaxonomyTerm>().toMatchTypeOf<{
      object: 'taxonomy_term';
      sourceSlug: string;
    }>();
    expectTypeOf<TaxonomyListQuery>().toMatchTypeOf<{
      q?: string;
      cursor?: string;
      limit?: number;
    }>();
    expectTypeOf<SuggestionsListQuery>().toMatchTypeOf<{
      q?: string;
      limit?: number;
    }>();
  });

  it('resolvers hit their kind routes with encoded slugs', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.taxonomy.categories.resolve('software-engineering');
    await board.taxonomy.skills.resolve('c++');
    await board.taxonomy.places.resolve('berlin');

    expect(sentUrl(spy, 0)).toBe(`${BASE}/categories/software-engineering`);
    // Encoding matters: skills like "c++" must not reach the server raw.
    expect(sentUrl(spy, 1)).toBe(`${BASE}/skills/c%2B%2B`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/places/berlin`);
  });

  it('remotePermits.list hits the board-scoped taxonomy alias', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.taxonomy.remotePermits.list();

    expect(sentUrl(spy, 0)).toBe(`${BASE}/remote-permits`);
  });

  it('places.list hits /places, with and without the autocomplete query', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.taxonomy.places.list();
    await board.taxonomy.places.list({ q: 'ber' });

    expect(sentUrl(spy, 0)).toBe(`${BASE}/places`);
    expect(sentUrl(spy, 1)).toBe(`${BASE}/places?q=ber`);
  });

  it('categories.list, skills.list, and suggestions.list pass collection queries unchanged', async () => {
    const spy = stubFetch();
    const board = makeBoard();

    await board.taxonomy.categories.list({ q: 'eng', limit: 5 });
    await board.taxonomy.skills.list({ cursor: 'next', limit: 10 });
    await board.taxonomy.suggestions.list({ q: 'type', limit: 3 });

    expect(sentUrl(spy, 0)).toBe(`${BASE}/categories?q=eng&limit=5`);
    expect(sentUrl(spy, 1)).toBe(`${BASE}/skills?cursor=next&limit=10`);
    expect(sentUrl(spy, 2)).toBe(`${BASE}/suggestions?q=type&limit=3`);
  });

  it('passes a resolution through unchanged', async () => {
    const resolution = {
      object: 'taxonomy_resolution',
      type: 'category',
      sourceSlug: 'software-engineering',
      canonicalSlug: 'software-engineering',
      displayName: 'Software Engineering',
      redirectTo: null,
    };
    stubFetch(resolution);
    expect(
      await makeBoard().taxonomy.categories.resolve('software-engineering'),
    ).toEqual(resolution);
  });
});

describe('board.paywall', () => {
  it('offers hits the enabled-offers route', async () => {
    const spy = stubFetch();
    await makeBoard().paywall.offers();
    expect(sentUrl(spy, 0)).toBe(`${BASE}/paywall/offers/enabled`);
  });

  it('passes the offer list through unchanged', async () => {
    const offers = {
      object: 'list',
      url: '/v1/boards/acme-jobs/paywall/offers/enabled',
      hasMore: false,
      nextCursor: null,
      data: [
        {
          object: 'paywall_offer',
          offerKey: 'monthly',
          label: 'Monthly access',
          billingLabel: 'per month',
          amountCents: 900,
          currency: 'usd',
          offerType: 'recurring',
          intervalUnit: 'month',
          intervalCount: 1,
          isDefault: true,
        },
      ],
    };
    stubFetch(offers);
    expect(await makeBoard().paywall.offers()).toEqual(offers);
  });
});
