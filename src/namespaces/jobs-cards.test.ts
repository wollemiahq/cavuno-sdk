import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

import type { ListEnvelope } from '../types/common';
import type { JobCardListEnvelope, PublicJobCard } from '../types/jobs';
import type { PublicPlace, TaxonomyResolution } from '../types/taxonomy';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(body: unknown) {
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

afterEach(() => vi.unstubAllGlobals());

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

// The exact wire body `serializeJobCard` + the job catalog envelope produce.
const CARD: PublicJobCard = {
  id: 'jobs_1',
  object: 'job_card',
  slug: 'senior-engineer',
  title: 'Senior Engineer',
  publishedAt: '2026-01-01T00:00:00.000Z',
  employmentType: 'full_time',
  isSponsored: false,
  remoteOption: 'remote',
  remoteLocationLabel: 'Worldwide',
  remoteWorldwide: true,
  isSponsored: false,
  remoteWorkPermitCountryCodes: [],
  salaryMin: 100000,
  salaryMax: null,
  salaryCurrency: 'USD',
  salaryTimeframe: 'per_year',
  isFeatured: true,
  summary: 'We build robots for every home.',
  locationLabel: null,
  company: { slug: 'acme', name: 'Acme', logoUrl: null },
  categories: [{ slug: 'engineering', name: 'Engineering' }],
  skills: [],
  links: {
    public: 'https://acme.cavuno.com/companies/acme/jobs/senior-engineer',
  },
};

const ENVELOPE: JobCardListEnvelope = {
  object: 'list',
  url: '/v1/boards/acme-jobs/jobs',
  hasMore: true,
  nextCursor: 'o:20',
  data: [CARD],
  count: 50,
  limit: 20,
  offset: 0,
  gatedCount: 48,
  relatedSearches: [
    { type: 'category', slug: 'engineering', term: 'Engineering', count: 5 },
  ],
};

describe('board.jobs.list — PublicJobCard envelope', () => {
  it('returns the wire body byte-identical — the SDK adds no transformation', async () => {
    stubFetch(ENVELOPE);
    const result = await makeBoard().jobs.list({ limit: 20 });
    // Deep-equal the canned envelope: nothing renamed, dropped, or reshaped.
    expect(result).toEqual(ENVELOPE);
    expect(result.data[0]!.object).toBe('job_card');
    expect(result.count).toBe(50);
    expect(result.gatedCount).toBe(48);
    expect(result.relatedSearches?.[0]!.type).toBe('category');
  });

  it('serializes offset + repeated multi-value facets + location/radius', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await makeBoard().jobs.list({
      limit: 20,
      offset: 40,
      remoteOption: ['remote', 'hybrid'],
      location: 'london',
      radius: 25,
    });
    const url = sentUrl(spy);
    expect(url).toContain('offset=40');
    expect(url).toContain('remoteOption=remote&remoteOption=hybrid');
    expect(url).toContain('location=london');
    expect(url).toContain('radius=25');
  });
});

describe('jobs sort — pass-through to the wire', () => {
  it('serializes ?sort on the browse list', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await makeBoard().jobs.list({ sort: 'newest' });
    expect(sentUrl(spy)).toContain('sort=newest');
  });

  it('sends sort in the search POST body', async () => {
    const spy = stubFetch({ object: 'search', data: [] });
    await makeBoard().jobs.search({ query: 'chef', sort: 'salary_high' });
    const init = spy.mock.calls[0]![1]!;
    expect(JSON.parse(init.body as string)).toMatchObject({
      query: 'chef',
      sort: 'salary_high',
    });
  });
});

describe('board.taxonomy.{categories,skills,places}.resolve', () => {
  const RES: TaxonomyResolution = {
    object: 'taxonomy_resolution',
    type: 'category',
    sourceSlug: 'engineering',
    canonicalSlug: 'engineering',
    displayName: 'Engineering',
    redirectTo: null,
    geo: null,
  };

  it.each(['categories', 'skills', 'places'] as const)(
    '%s.resolve GETs /:kind/:slug and passes the body through',
    async (ns) => {
      const spy = stubFetch(RES);
      const board = makeBoard();
      const result = await board.taxonomy[ns].resolve('engineering');
      expect(sentUrl(spy)).toBe(`${BASE}/${ns}/engineering`);
      expect(result).toEqual(RES);
    },
  );
});

describe('jobs.list ?category / ?skill seeds (programmatic pages)', () => {
  it('serializes the category + skill seed params', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await makeBoard().jobs.list({
      category: 'engineering',
      skill: 'typescript',
    });
    const url = sentUrl(spy);
    expect(url).toContain('category=engineering');
    expect(url).toContain('skill=typescript');
  });
});

describe('jobs.list ?fields=+description (RSS sparse-fieldset opt-in)', () => {
  it('serializes the fields param and passes the description through untouched', async () => {
    const withDescription: PublicJobCard = {
      ...CARD,
      description: '<h2>Overview</h2><p>Build robots.</p>',
    };
    const spy = stubFetch({ object: 'list', data: [withDescription] });
    const result = await makeBoard().jobs.list({ fields: '+description' });
    // `+` URL-encodes to %2B so the server doesn't see it as a space.
    expect(sentUrl(spy)).toContain('fields=%2Bdescription');
    expect(result.data[0]!.description).toBe(
      '<h2>Overview</h2><p>Build robots.</p>',
    );
  });
});

describe('board.taxonomy.places.list (the locations directory)', () => {
  it('GETs /places and passes the list through byte-identical (incl. the id/parentId hierarchy)', async () => {
    // Typed as PublicPlace[] so SDK type drift vs the serializer fails the
    // build — and so the `id`/`parentId` edges (which let a consumer rebuild
    // the hosted locations tree) are proven to pass through untouched.
    const places: PublicPlace[] = [
      {
        object: 'place',
        id: 'pp.greater-london',
        parentId: null,
        slug: 'greater-london',
        name: 'Greater London',
        placeType: 'region',
        countryCode: 'GB',
        regionCode: 'GB-ENG',
        jobCount: 20,
      },
      {
        object: 'place',
        id: 'pp.london',
        parentId: 'pp.greater-london', // the edge that rebuilds the tree
        slug: 'london',
        name: 'London',
        placeType: 'city',
        countryCode: 'GB',
        regionCode: 'GB-ENG',
        jobCount: 12,
      },
    ];
    const env: ListEnvelope<PublicPlace> = {
      object: 'list',
      url: '/v1/boards/acme-jobs/places',
      hasMore: false,
      nextCursor: null,
      data: places,
    };
    const spy = stubFetch(env);
    const result = await makeBoard().taxonomy.places.list();
    expect(sentUrl(spy)).toBe(`${BASE}/places`);
    expect(result).toEqual(env);
    expect(result.data[1]!.parentId).toBe('pp.greater-london');
    expect(result.data[0]!.jobCount).toBe(20);
  });

  it('forwards { q, limit } as the location-autocomplete query params', async () => {
    // The starter's location combobox calls `places.list({ q })` per keystroke;
    // the SDK must turn that into `?q=…&limit=…` (the autocomplete contract),
    // not silently drop it the way the FetchOptions-only signature did.
    const env: ListEnvelope<PublicPlace> = {
      object: 'list',
      url: '/v1/boards/acme-jobs/places',
      hasMore: false,
      nextCursor: null,
      data: [],
    };
    const spy = stubFetch(env);
    await makeBoard().taxonomy.places.list({ q: 'lon', limit: 5 });
    expect(sentUrl(spy)).toBe(`${BASE}/places?q=lon&limit=5`);
  });
});

describe('board.jobs apply methods', () => {
  it('apply POSTs /jobs/:slug/apply with the body', async () => {
    const spy = stubFetch({ object: 'application' });
    await makeBoard().jobs.apply('senior-chef', { coverNote: 'hi' });
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/senior-chef/apply`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"coverNote":"hi"}');
  });

  it('apply sends {} when no body given', async () => {
    const spy = stubFetch({ object: 'application' });
    await makeBoard().jobs.apply('senior-chef');
    expect(spy.mock.calls[0]![1]!.body).toBe('{}');
  });

  it('uploadApplicationResume POSTs multipart form-data', async () => {
    const spy = stubFetch({ object: 'application' });
    const file = new Blob(['x'], { type: 'application/pdf' });
    await makeBoard().jobs.uploadApplicationResume('senior-chef', file, {
      applicationId: 'jobapplications_1',
    });
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/senior-chef/apply/resume`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBeInstanceOf(FormData);
  });

  it('myApplication GETs /jobs/:slug/application', async () => {
    const spy = stubFetch({ object: 'application' });
    await makeBoard().jobs.myApplication('senior-chef');
    expect(sentUrl(spy)).toBe(`${BASE}/jobs/senior-chef/application`);
  });
});
