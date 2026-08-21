import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

import type { ListEnvelope } from '../types/common';
import type { PublicJobCard } from '../types/jobs';

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

// The exact wire body `serializeJobCard` produces for an embed card.
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

// The exact embed envelope: job catalog count/limit/offset + the offset-encoded
// nextCursor — and NO gatedCount, NO relatedSearches (the embed is ungated and
// has no related-search rail; that is the whole point of the surface).
const EMBED_ENVELOPE: ListEnvelope<PublicJobCard> = {
  object: 'list',
  url: '/v1/boards/acme-jobs/embed/jobs',
  hasMore: true,
  nextCursor: 'o:8',
  data: [CARD],
  count: 50,
  limit: 8,
  offset: 0,
};

describe('board.embed.jobs — ungated widget envelope', () => {
  it('returns the wire body byte-identical — the SDK adds no transformation', async () => {
    stubFetch(EMBED_ENVELOPE);
    const result = await makeBoard().embed.jobs({ limit: 8 });
    // Deep-equal the canned envelope: nothing renamed, dropped, or reshaped.
    expect(result).toEqual(EMBED_ENVELOPE);
    expect(result.data[0]!.object).toBe('job_card');
    expect(result.count).toBe(50);
    // The embed is ungated and rail-less — these MUST be absent on the wire,
    // mirroring the API 's gating-divergence guard at the SDK layer.
    expect(result).not.toHaveProperty('gatedCount');
    expect(result).not.toHaveProperty('relatedSearches');
  });

  it('GETs /embed/jobs and serializes q + offset + repeated facets + location/radius', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await makeBoard().embed.jobs({
      q: 'robotics',
      limit: 8,
      offset: 16,
      remoteOption: ['remote', 'hybrid'],
      employmentType: ['full_time'],
      location: 'london',
      radius: 25,
    });
    const url = sentUrl(spy);
    expect(url.startsWith(`${BASE}/embed/jobs`)).toBe(true);
    expect(url).toContain('q=robotics');
    expect(url).toContain('offset=16');
    expect(url).toContain('remoteOption=remote&remoteOption=hybrid');
    expect(url).toContain('employmentType=full_time');
    expect(url).toContain('location=london');
    expect(url).toContain('radius=25');
  });
});
