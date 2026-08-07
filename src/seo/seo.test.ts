import { describe, expect, it } from 'vitest';

import { createAuthorProfileJsonLd, createBlogArticleJsonLd } from './blog';
import { createBreadcrumbJsonLd } from './breadcrumbs';
import { ALL_COUNTRY_CODES, createJobPostingJsonLd } from './job-posting';
import { listingHead, listingJsonLd } from './listing';
import {
  buildSalaryFaq,
  companyCategorySalaryJsonLd,
  companySalaryJsonLd,
  crossAxisSalaryJsonLd,
  faqJsonLd,
  formatSalaryStat,
  formatSalaryStatRange,
  itemListJsonLd,
  locationSalaryJsonLd,
  SENIORITY_ORDER,
  skillSalaryJsonLd,
  sortBySeniority,
  titleSalaryJsonLd,
} from './salary';

import type { PublicBoard } from '../types/board';
import type { PublicJob } from '../types/jobs';

const BOARD = {
  object: 'public_board',
  id: 'boards_x',
  slug: 'acme-jobs',
  name: 'Acme Jobs',
  language: 'en',
  logoUrl: 'https://assets.example.com/board-logo.png',
  icons: {
    ico: null,
    svg: null,
    appleTouch: null,
    icon192: null,
    icon512: null,
    iconMaskable512: null,
  },
  primaryDomain: null,
  showCavunoBranding: true,
  features: {
    jobAlerts: true,
    candidates: true,
    employers: true,
    blog: true,
    talentDirectory: 'off',
    registrationWall: false,
    passwordProtected: false,
    publicJobSubmission: false,
    candidatePaywall: false,
    impressum: false,
    nativeApplications: true,
    messaging: true,
  },
  analytics: {
    ga4MeasurementId: null,
    gtmId: null,
    metaPixelId: null,
    linkedInPartnerId: null,
    cookieConsentRequired: false,
  },
  customFields: { job: [] },
  contact: {
    email: null,
    websiteUrl: null,
    xUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
  },
} satisfies PublicBoard;

const JOB = {
  id: 'jobs_1',
  object: 'public_job',
  title: 'Senior Robotics Engineer',
  slug: 'senior-robotics-engineer',
  status: 'published',
  companyId: 'companies_1',
  employmentType: 'full_time',
  remoteOption: 'remote',
  seniority: 'senior',
  salaryMin: 90000,
  salaryMax: 120000,
  salaryCurrency: 'eur',
  salaryTimeframe: 'per_year',
  isFeatured: false,
  publishedAt: '2026-06-01T00:00:00.000Z',
  expiresAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  description: '<p>Build robots.</p>',
  applicationUrl: null,
  remotePermits: [{ type: 'country', value: 'DE' }],
  remoteWorldwide: false,
  remoteTimezones: [],
  remoteAllowedTzOffsets: [],
  remoteWorkPermitCountryCodes: ['DE', 'AT'],
  remoteWorkPermitSubdivisionCodes: ['CH-ZH'],
  remoteSponsorship: 'unknown',
  educationRequirements: ['bachelor_degree', 'postgraduate_degree'],
  experienceMonths: 36,
  experienceInPlaceOfEducation: true,
  inOfficePeriod: null,
  inOfficeFrequency: null,
  company: {
    id: 'companies_1',
    name: 'Acme Robotics',
    slug: 'acme-robotics',
    logoUrl: 'https://assets.example.com/acme.png',
    website: 'acme-robotics.com',
  },
  officeLocations: [
    {
      countryCode: 'DE',
      country: 'Germany',
      locality: null,
      city: 'Berlin',
      region: 'Berlin',
      regionCode: 'BE',
      postalCode: '10115',
      displayName: 'Berlin, Germany',
    },
  ],
  categories: [{ slug: 'robotics-engineering', name: 'Robotics Engineering' }],
  skills: [{ slug: 'ros', name: 'ROS' }],
  placeHierarchy: [{ slug: 'germany', name: 'Germany' }],
  links: { public: null },
  customFieldValues: {},
} satisfies PublicJob;

const SHARE_URL =
  'https://starter.example.com/companies/acme-robotics/jobs/senior-robotics-engineer';

function build(overrides: Partial<PublicJob> = {}) {
  return createJobPostingJsonLd({
    job: { ...JOB, ...overrides },
    board: BOARD,
    shareUrl: SHARE_URL,
  });
}

describe('createJobPostingJsonLd — Google for Jobs structured data', () => {
  it('emits the core JobPosting envelope', () => {
    const ld = build()!;
    expect(ld['@context']).toBe('https://schema.org/');
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.title).toBe(JOB.title);
    expect(ld.description).toBe(JOB.description);
    expect(ld.datePosted).toBe('2026-06-01T00:00:00.000Z');
    expect(ld.validThrough).toBe('2026-09-01T00:00:00.000Z');
    expect(ld.employmentType).toBe('FULL_TIME');
    expect(ld.url).toBe(SHARE_URL);
    expect(ld.identifier).toEqual({
      '@type': 'PropertyValue',
      value: 'jobs_1',
      name: 'Acme Robotics',
    });
  });

  it('builds hiringOrganization from the company with normalized website + logo', () => {
    const ld = build()!;
    expect(ld.hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'Acme Robotics',
      sameAs: 'https://acme-robotics.com',
      logo: 'https://assets.example.com/acme.png',
    });
  });

  it('falls back to the board name when the job has no company', () => {
    const ld = build({ company: null })!;
    expect(ld.hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'Acme Jobs',
      logo: 'https://assets.example.com/board-logo.png',
    });
  });

  it('drops sameAs for a blank company website instead of emitting a bare scheme (hosted shape)', () => {
    const ld = build({ company: { ...JOB.company!, website: '   ' } })!;
    expect(
      (ld.hiringOrganization as Record<string, unknown>).sameAs,
    ).toBeUndefined();
  });

  it('maps salary to MonetaryAmount with uppercase currency and YEAR unit', () => {
    const ld = build()!;
    expect(ld.baseSalary).toEqual({
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: 90000,
        maxValue: 120000,
        unitText: 'YEAR',
      },
    });
  });

  it('collapses a single-ended salary to value + mirrored bound', () => {
    const ld = build({ salaryMin: null })!;
    expect(ld.baseSalary).toMatchObject({
      value: { value: 120000, minValue: 120000, maxValue: 120000 },
    });
  });

  it('omits baseSalary without a currency', () => {
    const ld = build({ salaryCurrency: null })!;
    expect(ld.baseSalary).toBeUndefined();
  });

  it('marks remote jobs TELECOMMUTE with deduped country requirements (subdivision prefixes collapse)', () => {
    const ld = build()!;
    expect(ld.jobLocationType).toBe('TELECOMMUTE');
    expect(ld.applicantLocationRequirements).toEqual([
      { '@type': 'Country', name: 'DE' },
      { '@type': 'Country', name: 'AT' },
      { '@type': 'Country', name: 'CH' },
    ]);
  });

  it('trims, uppercases, and dedupes permit codes', () => {
    const ld = build({
      remoteWorkPermitCountryCodes: [' de ', 'DE', 'at'],
      remoteWorkPermitSubdivisionCodes: ['DE-BE', 'US-CA'],
    })!;
    expect(ld.applicantLocationRequirements).toEqual([
      { '@type': 'Country', name: 'DE' },
      { '@type': 'Country', name: 'AT' },
      { '@type': 'Country', name: 'US' },
    ]);
  });

  it('lists all countries for worldwide-remote jobs (Google requires location requirements with TELECOMMUTE)', () => {
    const ld = build({ remoteWorldwide: true })!;
    const reqs = ld.applicantLocationRequirements as Array<{ name: string }>;
    expect(reqs).toHaveLength(249);
    expect(reqs.some((r) => r.name === 'DE')).toBe(true);
    // The hosted catalog: Kosovo in, North Korea out, common-name order.
    expect(reqs.some((r) => r.name === 'XK')).toBe(true);
    expect(reqs.some((r) => r.name === 'KP')).toBe(false);
    expect(reqs[0]!.name).toBe('AF');
    expect(reqs[1]!.name).toBe('AX');
  });

  it('omits TELECOMMUTE for on-site jobs and renders the office as a Place', () => {
    const ld = build({ remoteOption: 'on_site' })!;
    expect(ld.jobLocationType).toBeUndefined();
    expect(ld.applicantLocationRequirements).toBeUndefined();
    expect(ld.jobLocation).toEqual({
      '@type': 'Place',
      name: 'Berlin, Germany',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'DE',
        addressRegion: 'Berlin',
        addressLocality: 'Berlin',
        postalCode: '10115',
      },
    });
  });

  it('maps education to credentials in Google space-form, with the no_requirements short-circuit', () => {
    const ld = build()!;
    expect(ld.educationRequirements).toEqual([
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'bachelor degree',
      },
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'postgraduate degree',
      },
    ]);
    expect(
      build({ educationRequirements: ['no_requirements'] })!
        .educationRequirements,
    ).toBe('no requirements');
    expect(
      build({ educationRequirements: [] })!.educationRequirements,
    ).toBeUndefined();
  });

  it('maps experience months, with zero meaning no requirements, and emits experienceInPlaceOfEducation only when both blocks exist', () => {
    const ld = build()!;
    expect(ld.experienceRequirements).toEqual({
      '@type': 'OccupationalExperienceRequirements',
      monthsOfExperience: 36,
    });
    expect(ld.experienceInPlaceOfEducation).toBe(true);

    expect(build({ experienceMonths: 0 })!.experienceRequirements).toBe(
      'no requirements',
    );
    expect(
      build({ experienceMonths: null })!.experienceRequirements,
    ).toBeUndefined();
    expect(
      build({ educationRequirements: [] })!.experienceInPlaceOfEducation,
    ).toBeUndefined();
  });

  it('prunes null/empty branches rather than emitting them', () => {
    const ld = build({
      salaryCurrency: null,
      educationRequirements: [],
      experienceMonths: null,
      officeLocations: [],
      remoteWorkPermitCountryCodes: [],
      remoteWorkPermitSubdivisionCodes: [],
    })!;
    expect(ld.baseSalary).toBeUndefined();
    expect(ld.jobLocation).toBeUndefined();
    expect(ld.applicantLocationRequirements).toBeUndefined();
    expect(Object.values(ld).every((v) => v !== null && v !== undefined)).toBe(
      true,
    );
  });
});

describe('ALL_COUNTRY_CODES', () => {
  it('is the hosted 249-country catalog', () => {
    expect(ALL_COUNTRY_CODES).toHaveLength(249);
    expect(new Set(ALL_COUNTRY_CODES).size).toBe(249);
  });
});

describe('blog JSON-LD', () => {
  const AUTHOR = {
    id: 'authors_1',
    name: 'Ada Writer',
    slug: 'ada-writer',
    bio: 'Writes about robots.',
    avatarUrl: 'https://assets.example.com/ada.png',
    websiteUrl: 'ada.example.com',
    twitterUrl: 'https://twitter.com/ada',
    linkedinUrl: null,
    githubUrl: null,
  };

  const POST = {
    title: 'How robots hire',
    slug: 'how-robots-hire',
    customExcerpt: 'A tour of robotic recruiting.',
    publishedAt: '2026-05-01T00:00:00.000Z',
    coverUrl: 'https://assets.example.com/cover.png',
    authors: [AUTHOR],
  };

  it('builds the Article with cover image, author, and publisher', () => {
    const ld = createBlogArticleJsonLd({
      post: POST,
      boardName: 'Acme Jobs',
      permalink: 'https://acme.example.com/blog/how-robots-hire',
    });
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'How robots hire',
      description: 'A tour of robotic recruiting.',
      url: 'https://acme.example.com/blog/how-robots-hire',
      datePublished: '2026-05-01T00:00:00.000Z',
      image: 'https://assets.example.com/cover.png',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://acme.example.com/blog/how-robots-hire',
      },
      publisher: { '@type': 'Organization', name: 'Acme Jobs' },
      author: {
        '@type': 'Person',
        name: 'Ada Writer',
        url: 'ada.example.com',
      },
    });
  });

  it('prefers the cover over the OG fallback, and falls back when there is no cover (hosted precedence)', () => {
    const withCover = createBlogArticleJsonLd({
      post: POST,
      boardName: 'Acme Jobs',
      permalink: 'https://x.example.com/p',
      ogImageUrl: 'https://x.example.com/p/og',
    });
    expect(withCover.image).toBe('https://assets.example.com/cover.png');

    const withoutCover = createBlogArticleJsonLd({
      post: { ...POST, coverUrl: null },
      boardName: 'Acme Jobs',
      permalink: 'https://x.example.com/p',
      ogImageUrl: 'https://x.example.com/p/og',
    });
    expect(withoutCover.image).toBe('https://x.example.com/p/og');

    const noImage = createBlogArticleJsonLd({
      post: { ...POST, coverUrl: null },
      boardName: 'Acme Jobs',
      permalink: 'https://x.example.com/p',
    });
    expect(noImage.image).toBeUndefined();
  });

  it('builds the ProfilePage with normalized sameAs, hasPart posts, and the WriteAction counter', () => {
    const ld = createAuthorProfileJsonLd({
      author: AUTHOR,
      canonical: 'https://acme.example.com/blog/author/ada-writer',
      description: '  Writes about robots.  ',
      origin: 'https://acme.example.com',
      posts: [
        {
          title: 'How robots hire',
          slug: 'how-robots-hire',
          publishedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      totalPosts: 7,
    })!;

    const person = ld.mainEntity as Record<string, unknown>;
    expect(person['@id']).toBe(
      'https://acme.example.com/blog/author/ada-writer#profile',
    );
    expect(person.description).toBe('Writes about robots.');
    // normalizeUrl adds the scheme + URL-normalizes (trailing slash on origins).
    expect(person.sameAs).toEqual([
      'https://ada.example.com/',
      'https://twitter.com/ada',
    ]);
    expect(person.agentInteractionStatistic).toEqual({
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/WriteAction',
      userInteractionCount: 7,
    });
    expect(ld.hasPart).toEqual([
      {
        '@type': 'Article',
        headline: 'How robots hire',
        url: 'https://acme.example.com/blog/how-robots-hire',
        datePublished: '2026-05-01T00:00:00.000Z',
        author: {
          '@id': 'https://acme.example.com/blog/author/ada-writer#profile',
        },
      },
    ]);
  });

  it('keeps at most 5 hasPart posts, omits them without an origin, and returns null without a name', () => {
    const posts = Array.from({ length: 7 }, (_, i) => ({
      title: `Post ${i}`,
      slug: `post-${i}`,
      publishedAt: '2026-05-01T00:00:00.000Z',
    }));
    const ld = createAuthorProfileJsonLd({
      author: AUTHOR,
      canonical: 'https://acme.example.com/blog/author/ada-writer',
      description: 'd',
      origin: 'https://acme.example.com',
      posts,
      totalPosts: 7,
    })!;
    expect((ld.hasPart as unknown[]).length).toBe(5);

    const noOrigin = createAuthorProfileJsonLd({
      author: AUTHOR,
      canonical: 'https://acme.example.com/blog/author/ada-writer',
      description: 'd',
      origin: null,
      posts,
      totalPosts: 0,
    })!;
    expect(noOrigin.hasPart).toBeUndefined();
    expect(
      (noOrigin.mainEntity as Record<string, unknown>)
        .agentInteractionStatistic,
    ).toBeUndefined();

    expect(
      createAuthorProfileJsonLd({
        author: { ...AUTHOR, name: '' },
        canonical: 'https://x.example.com/a',
        description: 'd',
        origin: null,
        posts: [],
        totalPosts: 0,
      }),
    ).toBeNull();
  });
});

describe('createBreadcrumbJsonLd', () => {
  it('emits positioned ListItems; the current page (no href) omits item', () => {
    const ld = createBreadcrumbJsonLd([
      { label: 'Home', href: 'https://acme.example.com/' },
      { label: 'Blog', href: 'https://acme.example.com/blog' },
      { label: 'How robots hire' },
    ])!;
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://acme.example.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: 'https://acme.example.com/blog',
        },
        { '@type': 'ListItem', position: 3, name: 'How robots hire' },
      ],
    });
  });

  it('trims labels, drops empty items, and returns null for fewer than 2 crumbs (hosted semantics)', () => {
    const ld = createBreadcrumbJsonLd([
      { label: '  Home  ', href: 'https://x.example.com/' },
      { label: '   ' },
      { label: null },
      { label: 'Jobs' },
    ])!;
    expect(
      (ld.itemListElement as Array<{ name: string }>).map((i) => i.name),
    ).toEqual(['Home', 'Jobs']);

    expect(createBreadcrumbJsonLd([{ label: 'Home' }])).toBeNull();
    expect(createBreadcrumbJsonLd([])).toBeNull();
  });

  it('resolves relative hrefs against the origin; omits the item without one', () => {
    const withOrigin = createBreadcrumbJsonLd(
      [
        { label: 'Home', href: '/' },
        { label: 'Jobs', href: 'jobs' },
      ],
      { origin: 'https://acme.example.com' },
    )!;
    expect(
      (withOrigin.itemListElement as Array<{ item?: string }>).map(
        (i) => i.item,
      ),
    ).toEqual(['https://acme.example.com/', 'https://acme.example.com/jobs']);

    const withoutOrigin = createBreadcrumbJsonLd([
      { label: 'Home', href: '/' },
      { label: 'Jobs', href: 'https://acme.example.com/jobs' },
    ])!;
    expect(
      (withoutOrigin.itemListElement as Array<{ item?: string }>).map(
        (i) => i.item,
      ),
    ).toEqual([undefined, 'https://acme.example.com/jobs']);
  });
});

describe('salary formatters', () => {
  it('formats compact amounts in the board language and currency', () => {
    expect(formatSalaryStat('en', 90000, 'USD')).toBe('$90K');
    expect(formatSalaryStat('en', 1_500_000, 'USD')).toBe('$1.5M');
    // |value| < 1000 → standard by magnitude (same rule as formatSalaryRange).
    expect(formatSalaryStat('en', 950, 'USD')).toBe('$950.00');
    // de: locale digits/placement for USD.
    expect(formatSalaryStat('de', 90000, 'USD')).toContain('$');
    expect(formatSalaryStat('de', 90000, 'USD')).not.toBe(
      formatSalaryStat('en', 90000, 'USD'),
    );
    // EUR on a German board is not dollars.
    const eurDe = formatSalaryStat('de', 90000, 'EUR');
    expect(eurDe).toContain('€');
    expect(eurDe).not.toContain('$');
  });

  it('accepts notation override (standard full figures; compact short form)', () => {
    // Register, not locale — hero cards want compact; FAQ prose wants full.
    expect(formatSalaryStat('en', 90000, 'USD', 'standard')).toBe('$90,000.00');
    expect(formatSalaryStat('en', 22.5, 'USD', 'standard')).toBe('$22.50');
    expect(formatSalaryStat('en', 950, 'USD', 'compact')).toBe('$950');
    expect(formatSalaryStatRange('en', 100000, 150000, 'USD', 'standard')).toBe(
      '$100,000.00 – $150,000.00',
    );
    // Explicit compact still shortens large ranges.
    expect(formatSalaryStatRange('en', 100000, 150000, 'USD', 'compact')).toBe(
      '$100–150K',
    );
  });

  it('returns null when Intl rejects the locale or currency is empty/null', () => {
    // Prefer null over English M/k abbreviations or a bare `$`.
    expect(formatSalaryStat('not a locale!', 2_500_000, 'USD')).toBeNull();
    expect(formatSalaryStat('not a locale!', 90000, 'EUR')).toBeNull();
    expect(formatSalaryStat('en', 90000, '')).toBeNull();
    expect(formatSalaryStat('en', 90000, '   ')).toBeNull();
    // Runtime null/undefined must not throw (docs + skill promise string | null).
    expect(formatSalaryStat('en', 90000, null)).toBeNull();
    expect(formatSalaryStatRange('en', 90000, 120000, null)).toBeNull();
  });

  it('returns null for non-finite amounts (NaN / Infinity)', () => {
    expect(formatSalaryStat('en', Number.NaN, 'USD')).toBeNull();
    expect(formatSalaryStat('en', Number.POSITIVE_INFINITY, 'USD')).toBeNull();
    expect(
      formatSalaryStatRange('en', Number.NaN, 120000, 'USD'),
    ).toBeNull();
    expect(
      formatSalaryStatRange('en', 90000, Number.NaN, 'USD'),
    ).toBeNull();
  });

  it('formatSalaryStatRange uses Intl.formatRange', () => {
    expect(formatSalaryStatRange('en', 90000, 120000, 'USD')).toBe('$90–120K');
    // Identical bounds are a fixed salary, not a range — single amount
    // (ICU would emit ~$90K via approximatelySign for formatRange(X,X)).
    expect(formatSalaryStatRange('en', 90000, 90000, 'USD')).toBe('$90K');
    expect(formatSalaryStatRange('en', 90000, 120000, '')).toBeNull();
  });

  it('formatSalaryStatRange swaps inverted bounds so the range reads low→high', () => {
    expect(formatSalaryStatRange('en', 120000, 90000, 'USD')).toBe('$90–120K');
  });

  it('sortBySeniority orders by the ladder, unknown keys last, without mutating', () => {
    const rows = [
      { seniority: 'executive' },
      { seniority: 'mystery' },
      { seniority: 'entry_level' },
      { seniority: 'senior' },
    ];
    const sorted = sortBySeniority(rows);
    expect(sorted.map((r) => r.seniority)).toEqual([
      'entry_level',
      'senior',
      'executive',
      'mystery',
    ]);
    expect(rows[0]!.seniority).toBe('executive');
    expect(SENIORITY_ORDER[0]).toBe('entry_level');
  });
});

describe('buildSalaryFaq', () => {
  it('returns average + methodology kinds with range and raw figures', () => {
    const faq = buildSalaryFaq(
      'en',
      'JavaScript Developer',
      {
        avgMin: 70000,
        avgMax: 90000,
        jobCount: 42,
      },
      'USD',
    );
    expect(faq).toEqual([
      {
        kind: 'average',
        label: 'JavaScript Developer',
        range: formatSalaryStatRange('en', 70000, 90000, 'USD'),
        avgMin: 70000,
        avgMax: 90000,
        currency: 'USD',
        jobCount: 42,
      },
      {
        kind: 'methodology',
        label: 'JavaScript Developer',
      },
    ]);
    // Raw figures stay so the app can reformat (e.g. standard notation for FAQ prose).
    const avg = faq[0] as Extract<(typeof faq)[number], { kind: 'average' }>;
    expect(
      formatSalaryStatRange('en', avg.avgMin, avg.avgMax, avg.currency, 'standard'),
    ).toBe('$70,000.00 – $90,000.00');
  });

  it('formats the range for the board language and is empty without figures', () => {
    const one = buildSalaryFaq(
      'en',
      'X',
      {
        avgMin: 1000,
        avgMax: 2000,
        jobCount: 1,
      },
      'USD',
    );
    expect(one[0]).toMatchObject({
      kind: 'average',
      jobCount: 1,
      range: formatSalaryStatRange('en', 1000, 2000, 'USD'),
      avgMin: 1000,
      avgMax: 2000,
      currency: 'USD',
    });
    // No prose — jobCount stays a number for the app's plural rules.
    expect(one[0]).not.toHaveProperty('q');
    expect(one[0]).not.toHaveProperty('a');

    const de = buildSalaryFaq(
      'de',
      'X',
      {
        avgMin: 70000,
        avgMax: 90000,
        jobCount: 2,
      },
      'EUR',
    );
    expect(de[0]).toEqual({
      kind: 'average',
      label: 'X',
      range: formatSalaryStatRange('de', 70000, 90000, 'EUR'),
      avgMin: 70000,
      avgMax: 90000,
      currency: 'EUR',
      jobCount: 2,
    });

    expect(buildSalaryFaq('en', 'X', null, 'USD')).toEqual([]);
  });

  it('still returns average with raw figures when compact range is null', () => {
    // Empty currency → formatSalaryStatRange null, but numbers are not discarded.
    const faq = buildSalaryFaq(
      'en',
      'X',
      { avgMin: 70000, avgMax: 90000, jobCount: 3 },
      '',
    );
    expect(faq).toEqual([
      {
        kind: 'average',
        label: 'X',
        range: null,
        avgMin: 70000,
        avgMax: 90000,
        currency: '',
        jobCount: 3,
      },
      { kind: 'methodology', label: 'X' },
    ]);
  });
});

describe('salary JSON-LD builders', () => {
  const BY_SENIORITY = [
    {
      seniority: 'senior',
      avgSalaryMin: 110000,
      avgSalaryMax: 140000,
      jobCount: 4,
      boardAvgMin: null,
      boardAvgMax: null,
      boardMedianMin: null,
      boardMedianMax: null,
      boardP25Min: null,
      boardP75Min: null,
      boardP25Max: null,
      boardP75Max: null,
      diffPercent: null,
    },
  ];

  it('itemListJsonLd numbers the items; null when empty', () => {
    expect(itemListJsonLd([])).toBeNull();
    const ld = itemListJsonLd([
      { name: 'JavaScript', url: 'https://x.example.com/salaries/javascript' },
    ])!;
    expect(ld.numberOfItems).toBe(1);
    expect(ld.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'JavaScript',
        url: 'https://x.example.com/salaries/javascript',
      },
    ]);
  });

  it('faqJsonLd wraps items into a FAQPage; null when empty', () => {
    expect(faqJsonLd([])).toBeNull();
    const ld = faqJsonLd([{ q: 'Q?', a: 'A.' }])!;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Q?',
        acceptedAnswer: { '@type': 'Answer', text: 'A.' },
      },
    ]);
  });

  const seniorityWords: Record<string, string> = {
    entry_level: 'Entry level',
    executive: 'Executive',
    senior: 'Senior',
  };
  // App composes the finished name — including word order.
  const seniorityName = ({
    seniority,
    entity,
  }: {
    seniority: string;
    entity: string;
  }) => `${seniorityWords[seniority] ?? seniority} ${entity}`;

  it('titleSalaryJsonLd builds Occupation with data names; seniority via callback', () => {
    const detail = {
      categoryName: 'Robotics Engineering',
      currency: 'USD',
      boardP25Min: 80000,
      boardP75Max: 150000,
      overallSalary: {
        avgMin: 90000,
        avgMax: 130000,
        p25Min: 80000,
        p75Max: 150000,
        jobCount: 12,
      },
      bySeniority: [
        { ...BY_SENIORITY[0]!, seniority: 'executive' },
        { ...BY_SENIORITY[0]!, seniority: 'entry_level' },
      ],
    };
    const withLabels = titleSalaryJsonLd(detail as never, {
      seniorityName,
    })!;
    const dists = withLabels.estimatedSalary as Array<Record<string, unknown>>;
    expect(dists[0]).toMatchObject({
      '@type': 'MonetaryAmountDistribution',
      name: 'Robotics Engineering',
      minValue: 90000,
      maxValue: 130000,
      percentile25: 80000,
      percentile75: 150000,
      unitText: 'YEAR',
      duration: 'P1Y',
    });
    // Application-composed finished names — SDK does not join or invent order.
    expect(dists[1]!.name).toBe('Executive Robotics Engineering');
    expect(dists[2]!.name).toBe('Entry level Robotics Engineering');

    // French-style postfix composition is the app's choice, not the SDK's.
    const fr = titleSalaryJsonLd(detail as never, {
      seniorityName: ({ seniority, entity }) =>
        `${entity} ${({ executive: 'sénior', entry_level: 'débutant' } as Record<string, string>)[seniority] ?? seniority}`,
    })!;
    const frDists = fr.estimatedSalary as Array<Record<string, unknown>>;
    expect(frDists[1]!.name).toBe('Robotics Engineering sénior');
    expect(frDists[2]!.name).toBe('Robotics Engineering débutant');

    // Without seniorityName, per-seniority distributions omit `name`.
    const bare = titleSalaryJsonLd(detail as never)!;
    const bareDists = bare.estimatedSalary as Array<Record<string, unknown>>;
    expect(bareDists[0]!.name).toBe('Robotics Engineering');
    expect(bareDists[1]!.name).toBeUndefined();
    expect(bareDists[2]!.name).toBeUndefined();

    expect(
      titleSalaryJsonLd({ ...detail, overallSalary: null } as never),
    ).toBeNull();
  });

  it('skillSalaryJsonLd carries the rounded median; locationSalaryJsonLd is an ItemList', () => {
    const skill = skillSalaryJsonLd({
      skillName: 'ROS',
      currency: 'USD',
      overallSalary: {
        avgMin: 90000,
        avgMax: 130000,
        medianMin: 95000,
        medianMax: 100001,
        p25Min: 80000,
        p75Max: 150000,
        jobCount: 9,
      },
    } as never)!;
    expect(
      (skill.estimatedSalary as Array<Record<string, unknown>>)[0]!.median,
    ).toBe(97501);
    expect(
      (skill.estimatedSalary as Array<Record<string, unknown>>)[0]!.name,
    ).toBe('ROS');

    const location = {
      placeName: 'Berlin',
      countryCode: 'DE',
      adminLevel: 'city',
      currency: 'USD',
      overallSalary: {
        avgMin: 80000,
        avgMax: 120000,
        medianMin: 90000,
        medianMax: 100000,
        p25Min: 70000,
        p75Max: 130000,
        jobCount: 20,
      },
      topCategories: [
        {
          categorySlug: 'robotics-engineering',
          categoryName: 'Robotics Engineering',
          avgSalaryMin: 90000,
          avgSalaryMax: 130000,
          jobCount: 8,
        },
        {
          categorySlug: 'mechatronics',
          categoryName: 'Mechatronics',
          avgSalaryMin: 80000,
          avgSalaryMax: 110000,
          jobCount: 4,
        },
      ],
    };
    const city = locationSalaryJsonLd(location as never, {
      occupationUrl: (row) =>
        `https://jobs.example.com/salaries/titles/${row.categorySlug}`,
    })!;
    // Place/employer pages are not occupations — ItemList of real occupations.
    expect(city['@type']).toBe('ItemList');
    expect(city.numberOfItems).toBe(2);
    expect(city.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Robotics Engineering',
        url: 'https://jobs.example.com/salaries/titles/robotics-engineering',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Mechatronics',
        url: 'https://jobs.example.com/salaries/titles/mechatronics',
      },
    ]);
    expect(city.name).toBeUndefined();
    expect(city.occupationLocation).toBeUndefined();
    expect(city.estimatedSalary).toBeUndefined();
    expect(
      locationSalaryJsonLd(
        { ...location, adminLevel: 'region' } as never,
        {
          occupationUrl: (row) =>
            `https://jobs.example.com/salaries/titles/${row.categorySlug}`,
        },
      ),
    ).toBeNull();
    expect(
      locationSalaryJsonLd(
        { ...location, topCategories: [] } as never,
        {
          occupationUrl: (row) =>
            `https://jobs.example.com/salaries/titles/${row.categorySlug}`,
        },
      ),
    ).toBeNull();
  });

  it('crossAxisSalaryJsonLd uses data labels; seniority via callback', () => {
    const ld = crossAxisSalaryJsonLd(
      {
        name: 'Robotics Engineering',
        placeName: 'Berlin',
        countryCode: 'DE',
        currency: 'USD',
        overall: { avgMin: 90000, avgMax: 130000, p25Min: null, p75Max: null },
        bySeniority: [
          {
            seniority: 'executive',
            avgSalaryMin: 140000,
            avgSalaryMax: 180000,
          },
        ],
      },
      { seniorityName },
    )!;
    const dists = ld.estimatedSalary as Array<Record<string, unknown>>;
    expect(ld.name).toBe('Robotics Engineering');
    expect(ld.occupationLocation).toEqual({
      '@type': 'AdministrativeArea',
      name: 'Berlin',
      address: { '@type': 'PostalAddress', addressCountry: 'DE' },
    });
    expect(dists[0]!.name).toBe('Robotics Engineering');
    expect(dists[0]!.percentile25).toBeUndefined();
    expect(dists[1]!.name).toBe('Executive Robotics Engineering');

    const bare = crossAxisSalaryJsonLd({
      name: 'Robotics Engineering',
      placeName: 'Berlin',
      countryCode: 'DE',
      currency: 'USD',
      overall: { avgMin: 90000, avgMax: 130000, p25Min: null, p75Max: null },
      bySeniority: [
        { seniority: 'executive', avgSalaryMin: 140000, avgSalaryMax: 180000 },
      ],
    })!;
    expect(
      (bare.estimatedSalary as Array<Record<string, unknown>>)[1]!.name,
    ).toBeUndefined();
  });

  it('companySalaryJsonLd is an ItemList; companyCategory keeps Occupation', () => {
    const company = companySalaryJsonLd(
      {
        companyName: 'Acme Robotics',
        companySlug: 'acme-robotics',
        currency: 'USD',
        boardMedianMin: 90000,
        boardMedianMax: 110001,
        boardP25Min: 80000,
        boardP75Max: 150000,
        overallSalary: { avgMin: 90000, avgMax: 130000, jobCount: 15 },
        bySeniority: BY_SENIORITY,
        byCategory: [
          {
            categorySlug: 'robotics-engineering',
            categoryName: 'Robotics Engineering',
            avgSalaryMin: 90000,
            avgSalaryMax: 130000,
            jobCount: 6,
          },
        ],
      } as never,
      {
        occupationUrl: (row) =>
          `https://jobs.example.com/companies/acme-robotics/salaries/${row.categorySlug}`,
      },
    )!;
    expect(company['@type']).toBe('ItemList');
    expect(company.numberOfItems).toBe(1);
    expect(company.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Robotics Engineering',
        url: 'https://jobs.example.com/companies/acme-robotics/salaries/robotics-engineering',
      },
    ]);
    expect(company.name).toBeUndefined();
    expect(company.estimatedSalary).toBeUndefined();
    expect(
      companySalaryJsonLd(
        { byCategory: [] } as never,
        {
          occupationUrl: (row) =>
            `https://jobs.example.com/companies/acme/salaries/${row.categorySlug}`,
        },
      ),
    ).toBeNull();

    const category = companyCategorySalaryJsonLd(
      {
        companyName: 'Acme Robotics',
        categoryName: 'Robotics Engineering',
        currency: 'USD',
        boardCategoryP25Min: 80000,
        boardCategoryP75Max: 150000,
        overallSalary: { avgMin: 90000, avgMax: 130000, jobCount: 6 },
        bySeniority: BY_SENIORITY,
      } as never,
      { seniorityName },
    )!;
    expect(category['@type']).toBe('Occupation');
    expect(category.name).toBe('Robotics Engineering');
    expect(category.occupationalCategory).toBe('Robotics Engineering');
    expect(
      (category.estimatedSalary as Array<Record<string, unknown>>)[0]!.name,
    ).toBe('Robotics Engineering');
    expect(
      (category.estimatedSalary as Array<Record<string, unknown>>)[1]!.name,
    ).toBe('Senior Robotics Engineering');
  });
});

describe('listingHead', () => {
  it('passes through caller title + description into meta, OG, and canonical', () => {
    const title = '42 Robotics jobs in Berlin | Acme Jobs';
    const description =
      'Browse 42 Robotics jobs in Berlin on Acme Jobs.';
    const head = listingHead({
      title,
      origin: 'https://acme.example.com',
      path: '/jobs/robotics',
      description,
    });
    expect(head.meta).toEqual([
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      {
        property: 'og:url',
        content: 'https://acme.example.com/jobs/robotics',
      },
    ]);
    expect(head.links).toEqual([
      {
        rel: 'canonical',
        href: 'https://acme.example.com/jobs/robotics',
      },
    ]);
  });

  it('does not invent, case-fold, or rearrange the title or description', () => {
    // Application-composed titles keep counters/particles/order (ja 件の, …).
    const title = '1,225件の求人 | 求人ボード';
    const description = 'İstanbul iş ilanlarını keşfedin.';
    const head = listingHead({
      title,
      origin: 'https://tr.example.com',
      path: '/jobs',
      description,
    });
    expect(head.meta[0]).toEqual({ title });
    expect(head.meta[1]).toEqual({
      name: 'description',
      content: description,
    });
    expect(head.meta[2]).toEqual({ property: 'og:title', content: title });
  });

  it('does not require count/heading/boardName — those were English arrangement', () => {
    const head = listingHead({
      title: 'Jobs | Acme Jobs',
      origin: 'https://acme.example.com',
      path: '/jobs',
      description: 'Browse jobs on Acme Jobs.',
    });
    expect(head.meta[0]).toEqual({ title: 'Jobs | Acme Jobs' });
    // Malformed locale tags used to crash unguarded Intl.NumberFormat on count.
    // With title ownership outside the SDK there is nothing to format.
    expect(() =>
      listingHead({
        title: '1,225 求人 | 求人ボード',
        origin: 'https://ja.example.com',
        path: '/jobs',
        description: '…',
      }),
    ).not.toThrow();
  });
});

describe('listingJsonLd', () => {
  it('emits the breadcrumb trail and the job ItemList via jobDetailPath', () => {
    const objects = listingJsonLd({
      origin: 'https://acme.example.com',
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Jobs' }],
      jobs: [
        { slug: 'robot-wrangler', company: { slug: 'acme-robotics' } },
        // Company-less jobs have no detail URL (`/jobs/{slug}` is a listing).
        { slug: 'orphan-job', company: null },
      ],
    });
    expect(objects).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://acme.example.com/',
          },
          { '@type': 'ListItem', position: 2, name: 'Jobs' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            url: 'https://acme.example.com/companies/acme-robotics/jobs/robot-wrangler',
          },
        ],
      },
    ]);
  });

  it('omits BreadcrumbList when the trail has fewer than 2 crumbs', () => {
    expect(
      listingJsonLd({
        origin: 'https://x.example.com',
        breadcrumbs: [],
      }),
    ).toEqual([]);
    expect(
      listingJsonLd({
        origin: 'https://x.example.com',
        breadcrumbs: [{ name: 'Home', path: '/' }],
      }),
    ).toEqual([]);
  });

  it('omits the ItemList without company-bearing jobs', () => {
    expect(
      listingJsonLd({
        origin: 'https://x.example.com',
        breadcrumbs: [
          { name: 'Home', path: '/' },
          { name: 'Jobs', path: '/jobs' },
        ],
        jobs: [{ slug: 'orphan', company: null }],
      }),
    ).toHaveLength(1);
  });
});
