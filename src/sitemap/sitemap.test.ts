import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MIN_JOBS_PER_INDEXED_PAGE,
  buildBucketUrls,
  listedBuckets,
} from './walker';
import {
  SITEMAP_BUCKETS,
  bucketFilename,
  chunk,
  parseBucketFilename,
  renderSitemapIndex,
  renderUrlset,
  xmlEscape,
} from './xml';

import type { BoardSdk } from '../index';

describe('xmlEscape', () => {
  it('escapes the five XML-significant characters so a slug cannot break the document', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
});

describe('bucketFilename / parseBucketFilename', () => {
  it('maps chunk 0 to the bare bucket name (cleanest URL for the common case)', () => {
    expect(bucketFilename('jobs-details', 0)).toBe('jobs-details.xml');
    expect(bucketFilename('marketing')).toBe('marketing.xml');
  });

  it('numbers chunk N (>0) as -(N+1) so humans see -2, -3, …', () => {
    expect(bucketFilename('jobs-details', 1)).toBe('jobs-details-2.xml');
    expect(bucketFilename('jobs-details', 2)).toBe('jobs-details-3.xml');
  });

  it('round-trips a filename back to bucket + chunk index', () => {
    expect(parseBucketFilename('jobs-details.xml')).toEqual({
      bucket: 'jobs-details',
      chunkIndex: 0,
    });
    expect(parseBucketFilename('jobs-details-2.xml')).toEqual({
      bucket: 'jobs-details',
      chunkIndex: 1,
    });
  });

  it('round-trips every bucket at chunk 0..3', () => {
    for (const bucket of SITEMAP_BUCKETS) {
      for (const chunkIndex of [0, 1, 2, 3]) {
        expect(parseBucketFilename(bucketFilename(bucket, chunkIndex))).toEqual(
          { bucket, chunkIndex },
        );
      }
    }
  });

  it('rejects unknown buckets and non-xml filenames (a 404, not a guess)', () => {
    expect(parseBucketFilename('unknown.xml')).toBeNull();
    expect(parseBucketFilename('marketing')).toBeNull();
    expect(parseBucketFilename('marketing-1.xml')).toBeNull(); // -1 is not a valid 2+ chunk
  });
});

describe('chunk', () => {
  it('splits into fixed-size slices, last slice shorter', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when under the limit', () => {
    expect(chunk([1, 2, 3], 45_000)).toEqual([[1, 2, 3]]);
  });

  it('returns no chunks for an empty list (an empty bucket is not listed)', () => {
    expect(chunk([], 45_000)).toEqual([]);
  });

  it('splits exactly at the boundary (45k + 1 → two chunks)', () => {
    const items = Array.from({ length: 45_001 }, (_, i) => i);
    const chunks = chunk(items, 45_000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(45_000);
    expect(chunks[1]).toEqual([45_000]);
  });
});

describe('renderUrlset', () => {
  it('wraps each URL in <url>/<loc> and escapes it', () => {
    const xml = renderUrlset(['https://b.com/a', 'https://b.com/x?y=1&z=2']);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://b.com/a</loc>');
    expect(xml).toContain('<loc>https://b.com/x?y=1&amp;z=2</loc>');
  });

  it('serializes lastModified — Date as ISO 8601, string as-is', () => {
    const xml = renderUrlset([
      {
        url: 'https://b.com/a',
        lastModified: new Date('2026-01-02T03:04:05Z'),
      },
      { url: 'https://b.com/b', lastModified: '2026-06-01' },
    ]);
    expect(xml).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-06-01</lastmod>');
  });

  it('adds the image namespace + image:loc only when an entry carries images', () => {
    const bare = renderUrlset([{ url: 'https://b.com/a' }]);
    expect(bare).not.toContain('xmlns:image');

    const withImage = renderUrlset([
      { url: 'https://b.com/a', images: ['https://cdn.b.com/logo.png'] },
    ]);
    expect(withImage).toContain(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    );
    expect(withImage).toContain(
      '<image:loc>https://cdn.b.com/logo.png</image:loc>',
    );
  });
});

describe('renderSitemapIndex', () => {
  it('wraps each sub-sitemap URL in <sitemap>/<loc>', () => {
    const xml = renderSitemapIndex(['https://b.com/sitemap/marketing.xml']);
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://b.com/sitemap/marketing.xml</loc>');
  });

  it('serializes lastModified on index entries', () => {
    const xml = renderSitemapIndex([
      {
        url: 'https://b.com/sitemap/blog.xml',
        lastModified: new Date('2026-01-02T03:04:05Z'),
      },
    ]);
    expect(xml).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>');
  });
});

// --- walker ---

const ORIGIN = 'https://board.example';

interface StubOverrides {
  features?: Record<string, boolean>;
  language?: string;
  jobs?: unknown[];
  companies?: unknown[];
  markets?: unknown[];
  salaryCompanies?: unknown[];
  salaryTitles?: unknown[];
  salarySkills?: unknown[];
  salaryLocations?: unknown[];
  blogPosts?: unknown[];
  /** Full override of jobs.list for pagination-behavior tests. */
  jobsList?: (query?: Record<string, unknown>) => Promise<unknown>;
}

function envelope(data: unknown[], extra: Record<string, unknown> = {}) {
  return {
    object: 'list',
    url: '/v1/x',
    hasMore: false,
    nextCursor: null,
    data,
    ...extra,
  };
}

/** Single-page envelope with `count` so offset enumeration stops after page 0. */
function singlePage(data: unknown[]) {
  return envelope(data, { count: data.length });
}

function stubBoard(overrides: StubOverrides = {}): BoardSdk {
  const features = {
    jobAlerts: false,
    candidates: false,
    employers: false,
    blog: true,
    talentDirectory: false,
    registrationWall: false,
    passwordProtected: false,
    publicJobSubmission: false,
    candidatePaywall: false,
    impressum: false,
    ...overrides.features,
  };
  const board = {
    context: async () => ({
      language: overrides.language ?? 'en',
      features,
    }),
    jobs: {
      list:
        overrides.jobsList ?? (async () => singlePage(overrides.jobs ?? [])),
    },
    companies: {
      list: async () => singlePage(overrides.companies ?? []),
      markets: async () => envelope(overrides.markets ?? []),
    },
    salaries: {
      companies: {
        list: async () => envelope(overrides.salaryCompanies ?? []),
      },
      titles: {
        list: async (_q?: unknown) => envelope(overrides.salaryTitles ?? []),
      },
      skills: {
        list: async (_q?: unknown) => envelope(overrides.salarySkills ?? []),
      },
      locations: {
        list: async (_q?: unknown) => envelope(overrides.salaryLocations ?? []),
      },
    },
    blog: {
      posts: { list: async () => envelope(overrides.blogPosts ?? []) },
    },
  };
  return board as unknown as BoardSdk;
}

function job(
  slug: string,
  companySlug: string | null,
  categories: string[] = [],
  skills: string[] = [],
) {
  return {
    slug,
    company: companySlug
      ? { slug: companySlug, name: companySlug, logoUrl: null }
      : null,
    categories: categories.map((s) => ({ slug: s, name: s })),
    skills: skills.map((s) => ({ slug: s, name: s })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listedBuckets', () => {
  it('lists all 8 buckets, in the canonical order, when blog is enabled', async () => {
    const buckets = await listedBuckets(
      stubBoard({ features: { blog: true } }),
    );
    expect(buckets).toEqual([...SITEMAP_BUCKETS]);
  });

  it('drops only the blog bucket when the blog feature is off', async () => {
    const buckets = await listedBuckets(
      stubBoard({ features: { blog: false } }),
    );
    expect(buckets).toEqual(SITEMAP_BUCKETS.filter((b) => b !== 'blog'));
  });
});

describe('marketing bucket', () => {
  it('emits the fixed page list, gating impressum/talent/employers by feature', async () => {
    const base = await buildBucketUrls(stubBoard(), ORIGIN, 'marketing');
    expect(base).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/jobs`,
      `${ORIGIN}/about`,
      `${ORIGIN}/privacy-policy`,
      `${ORIGIN}/terms-of-service`,
      `${ORIGIN}/cookie-policy`,
    ]);

    const gated = await buildBucketUrls(
      stubBoard({
        features: { impressum: true, talentDirectory: true, employers: true },
      }),
      ORIGIN,
      'marketing',
    );
    expect(gated).toEqual([
      ...base,
      `${ORIGIN}/impressum`,
      `${ORIGIN}/talent`,
      `${ORIGIN}/employers`,
    ]);
  });
});

describe('jobs taxonomy buckets', () => {
  it('applies the ≥5-job thin-content floor per category', async () => {
    const jobs = [
      ...Array.from({ length: MIN_JOBS_PER_INDEXED_PAGE }, (_, i) =>
        job(`j${i}`, 'acme', ['engineering']),
      ),
      ...Array.from({ length: MIN_JOBS_PER_INDEXED_PAGE - 1 }, (_, i) =>
        job(`k${i}`, 'acme', ['design']),
      ),
    ];
    const urls = await buildBucketUrls(
      stubBoard({ jobs }),
      ORIGIN,
      'jobs-categories',
    );
    expect(urls).toEqual([`${ORIGIN}/jobs/engineering`]);
  });

  it('counts a job once per slug even when tagged twice (Set dedupe within a job)', async () => {
    // 4 distinct jobs, one of them tagged 'sales' twice — still below the floor.
    const twice = job('dup', 'acme', ['sales', 'sales']);
    const jobs = [
      twice,
      ...Array.from({ length: 3 }, (_, i) => job(`j${i}`, 'acme', ['sales'])),
    ];
    const urls = await buildBucketUrls(
      stubBoard({ jobs }),
      ORIGIN,
      'jobs-categories',
    );
    expect(urls).toEqual([]);
  });

  it('emits skills under /jobs/skills, sorted', async () => {
    const jobs = Array.from({ length: 5 }, (_, i) =>
      job(`j${i}`, 'acme', [], ['zig', 'ada']),
    );
    const urls = await buildBucketUrls(
      stubBoard({ jobs }),
      ORIGIN,
      'jobs-skills',
    );
    expect(urls).toEqual([
      `${ORIGIN}/jobs/skills/ada`,
      `${ORIGIN}/jobs/skills/zig`,
    ]);
  });
});

describe('jobs-locations bucket', () => {
  it('sources place slugs from the salary-location index, floored and sorted, passing the board language', async () => {
    let seenQuery: unknown;
    const board = stubBoard({ language: 'de', salaryLocations: [] });
    (board.salaries.locations.list as unknown) = async (q: unknown) => {
      seenQuery = q;
      return envelope([
        { placeSlug: 'berlin', jobCount: 12 },
        { placeSlug: 'aachen', jobCount: 5 },
        { placeSlug: 'kiel', jobCount: 4 },
      ]);
    };

    const urls = await buildBucketUrls(board, ORIGIN, 'jobs-locations');
    expect(urls).toEqual([
      `${ORIGIN}/jobs/locations/aachen`,
      `${ORIGIN}/jobs/locations/berlin`,
    ]);
    expect(seenQuery).toEqual({ locale: 'de' });
  });
});

describe('jobs-details bucket', () => {
  it('emits company-scoped job URLs, deduped and sorted, skipping jobs without a company or slug', async () => {
    const jobs = [
      job('zeta', 'acme'),
      job('alpha', 'acme'),
      job('alpha', 'acme'), // duplicate URL → deduped
      job('orphan', null), // no company → skipped
      { ...job('noslug', 'acme'), slug: null }, // no slug → skipped
    ];
    const urls = await buildBucketUrls(
      stubBoard({ jobs }),
      ORIGIN,
      'jobs-details',
    );
    expect(urls).toEqual([
      `${ORIGIN}/companies/acme/jobs/alpha`,
      `${ORIGIN}/companies/acme/jobs/zeta`,
    ]);
  });
});

describe('companies bucket', () => {
  it('emits the hub, every company, and every market', async () => {
    const urls = await buildBucketUrls(
      stubBoard({
        companies: [{ slug: 'acme' }, { slug: 'globex' }],
        markets: [{ slug: 'robotics' }],
      }),
      ORIGIN,
      'companies',
    );
    expect(urls).toEqual([
      `${ORIGIN}/companies`,
      `${ORIGIN}/companies/acme`,
      `${ORIGIN}/companies/globex`,
      `${ORIGIN}/companies/markets/robotics`,
    ]);
  });
});

describe('salaries bucket', () => {
  it('emits nothing when every salary axis is empty (no thin hub page)', async () => {
    const urls = await buildBucketUrls(stubBoard(), ORIGIN, 'salaries');
    expect(urls).toEqual([]);
  });

  it('emits the hub plus only the axes that have data', async () => {
    const urls = await buildBucketUrls(
      stubBoard({
        salaryCompanies: [{ companySlug: 'acme' }],
        salaryTitles: [{ slug: 'engineer' }],
        salarySkills: [],
        salaryLocations: [{ placeSlug: 'berlin', jobCount: 9 }],
      }),
      ORIGIN,
      'salaries',
    );
    expect(urls).toEqual([
      `${ORIGIN}/salaries`,
      `${ORIGIN}/salaries/companies`,
      `${ORIGIN}/companies/acme/salaries`,
      `${ORIGIN}/salaries/titles`,
      `${ORIGIN}/salaries/titles/engineer`,
      `${ORIGIN}/salaries/locations`,
      `${ORIGIN}/salaries/locations/berlin`,
    ]);
  });
});

describe('blog bucket', () => {
  it('emits the index, every post, and tag/author pages derived from post embeds', async () => {
    const urls = await buildBucketUrls(
      stubBoard({
        blogPosts: [
          {
            slug: 'hello',
            tags: [{ slug: 'news' }],
            authors: [{ slug: 'ada' }],
          },
          {
            slug: 'world',
            tags: [{ slug: 'news' }, { slug: 'ai' }],
            authors: [],
          },
        ],
      }),
      ORIGIN,
      'blog',
    );
    expect(urls).toEqual([
      `${ORIGIN}/blog`,
      `${ORIGIN}/blog/hello`,
      `${ORIGIN}/blog/world`,
      `${ORIGIN}/blog/tag/ai`,
      `${ORIGIN}/blog/tag/news`,
      `${ORIGIN}/blog/author/ada`,
    ]);
  });

  it('follows the cursor across pages', async () => {
    let calls = 0;
    const board = stubBoard();
    (board.blog.posts.list as unknown) = async (q?: { cursor?: string }) => {
      calls += 1;
      if (!q?.cursor) {
        return envelope([{ slug: 'one', tags: [], authors: [] }], {
          hasMore: true,
          nextCursor: 'c1',
        });
      }
      expect(q.cursor).toBe('c1');
      return envelope([{ slug: 'two', tags: [], authors: [] }]);
    };
    const urls = await buildBucketUrls(board, ORIGIN, 'blog');
    expect(calls).toBe(2);
    expect(urls).toEqual([
      `${ORIGIN}/blog`,
      `${ORIGIN}/blog/one`,
      `${ORIGIN}/blog/two`,
    ]);
  });
});

describe('pagination behavior', () => {
  it('enumerates jobs by parallel offsets when the envelope carries count', async () => {
    const offsets: number[] = [];
    const board = stubBoard({
      jobsList: async (q) => {
        const offset = (q?.offset as number) ?? 0;
        offsets.push(offset);
        return envelope([job(`j${offset}`, 'acme')], { count: 250 });
      },
    });
    const urls = await buildBucketUrls(board, ORIGIN, 'jobs-details');
    expect(offsets.sort((a, b) => a - b)).toEqual([0, 100, 200]);
    expect(urls).toHaveLength(3);
  });

  it('does not enumerate offsets past the 10,000 window and warns about the tail', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const offsets: number[] = [];
    const board = stubBoard({
      jobsList: async (q) => {
        const offset = (q?.offset as number) ?? 0;
        offsets.push(offset);
        return envelope([job(`j${offset}`, 'acme')], { count: 10_050 });
      },
    });
    await buildBucketUrls(board, ORIGIN, 'jobs-details');
    expect(Math.max(...offsets)).toBe(9_900);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds the 10000 offset ceiling'),
    );
  });

  it('falls back to the cursor walk when count is absent, capped at 200 pages with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let cursorCalls = 0;
    const board = stubBoard({
      jobsList: async (q) => {
        if (q?.offset !== undefined) {
          // The offset probe: no `count` → walker falls back to cursors.
          return envelope([job('probe', 'acme')]);
        }
        cursorCalls += 1;
        return envelope([job(`j${cursorCalls}`, 'acme')], {
          hasMore: true,
          nextCursor: `c${cursorCalls}`,
        });
      },
    });
    const urls = await buildBucketUrls(board, ORIGIN, 'jobs-details');
    expect(cursorCalls).toBe(200);
    expect(urls).toHaveLength(200);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('200-page pagination cap'),
    );
  });

  it('does not warn when the walk completes exactly at the page cap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let cursorCalls = 0;
    const board = stubBoard({
      jobsList: async (q) => {
        if (q?.offset !== undefined) return envelope([job('probe', 'acme')]);
        cursorCalls += 1;
        const done = cursorCalls === 200;
        return envelope([job(`j${cursorCalls}`, 'acme')], {
          hasMore: !done,
          nextCursor: done ? null : `c${cursorCalls}`,
        });
      },
    });
    const urls = await buildBucketUrls(board, ORIGIN, 'jobs-details');
    expect(urls).toHaveLength(200);
    expect(warn).not.toHaveBeenCalled();
  });
});
