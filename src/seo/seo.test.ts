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
  formatRange,
  formatSeniority,
  formatUsd,
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
  theme: null,
  customFields: [],
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
  it('formats compact USD in the board language (USD-hardcoded, hosted quirk)', () => {
    expect(formatUsd('en', 90000)).toBe('$90K');
    expect(formatUsd('en', 1_500_000)).toBe('$1.5M');
    expect(formatUsd('en', 950)).toBe('$950');
    // de: locale digits/placement, still USD.
    expect(formatUsd('de', 90000)).toContain('$');
    expect(formatUsd('de', 90000)).not.toBe(formatUsd('en', 90000));
  });

  it('falls back to manual $ suffixes when Intl rejects the locale', () => {
    expect(formatUsd('not a locale!', 2_500_000)).toBe('$2.5M');
    expect(formatUsd('not a locale!', 90000)).toBe('$90k');
    expect(formatUsd('not a locale!', 950)).toBe('$950');
  });

  it('formatRange joins with the hosted spaced en dash and never collapses', () => {
    expect(formatRange('en', 90000, 120000)).toBe('$90K – $120K');
    expect(formatRange('en', 90000, 90000)).toBe('$90K – $90K');
  });

  it('formatSeniority: override > lexicon (en/de) > title-case fallback', () => {
    expect(formatSeniority('en', 'entry_level')).toBe('Entry level');
    expect(formatSeniority('de', 'entry_level')).toBe('Entry-Level');
    expect(formatSeniority('de', 'executive')).toBe('Führungskraft');
    expect(formatSeniority('en', 'executive', { executive: 'C-Suite' })).toBe(
      'C-Suite',
    );
    expect(formatSeniority('en', 'staff_engineer')).toBe('Staff Engineer');
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
  it('templates the two-question FAQ with a board-language range', () => {
    const faq = buildSalaryFaq('en', 'JavaScript Developer', {
      avgMin: 70000,
      avgMax: 90000,
      jobCount: 42,
    });
    expect(faq).toHaveLength(2);
    expect(faq[0]!.q).toBe(
      'What is the average salary for JavaScript Developer?',
    );
    expect(faq[0]!.a).toBe(
      'The average salary for JavaScript Developer is $70K – $90K per year, based on 42 job postings on this board that disclose pay.',
    );
    expect(faq[1]!.q).toBe(
      'How is the salary figure for JavaScript Developer calculated?',
    );
  });

  it('singularizes one posting, localizes only the figures on a de board, and is empty without figures', () => {
    const one = buildSalaryFaq('en', 'X', {
      avgMin: 1000,
      avgMax: 2000,
      jobCount: 1,
    });
    expect(one[0]!.a).toContain('1 job posting on');

    const de = buildSalaryFaq('de', 'X', {
      avgMin: 70000,
      avgMax: 90000,
      jobCount: 2,
    });
    // English sentence frame (templated-interim), de-formatted USD figures.
    expect(de[0]!.a).toContain('The average salary for X is');
    expect(de[0]!.a).toContain(formatRange('de', 70000, 90000));

    expect(buildSalaryFaq('en', 'X', null)).toEqual([]);
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

  it('titleSalaryJsonLd builds the Occupation with lexicon seniority names (en + de)', () => {
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
      bySeniority: [{ ...BY_SENIORITY[0]!, seniority: 'executive' }],
    };
    const en = titleSalaryJsonLd('en', detail as never)!;
    const dists = en.estimatedSalary as Array<Record<string, unknown>>;
    expect(dists[0]).toMatchObject({
      '@type': 'MonetaryAmountDistribution',
      name: 'Robotics Engineering salary (all levels)',
      minValue: 90000,
      maxValue: 130000,
      percentile25: 80000,
      percentile75: 150000,
      unitText: 'YEAR',
      duration: 'P1Y',
    });
    expect(dists[1]!.name).toBe('Executive Robotics Engineering');

    const de = titleSalaryJsonLd('de', detail as never)!;
    expect(
      (de.estimatedSalary as Array<Record<string, unknown>>)[1]!.name,
    ).toBe('Führungskraft Robotics Engineering');

    expect(
      titleSalaryJsonLd('en', { ...detail, overallSalary: null } as never),
    ).toBeNull();
  });

  it('skillSalaryJsonLd carries the rounded median; locationSalaryJsonLd gates on city level', () => {
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
    };
    const city = locationSalaryJsonLd(location as never)!;
    expect(city.name).toBe('Average Salary in Berlin');
    expect(city.occupationLocation).toEqual({
      '@type': 'City',
      name: 'Berlin',
      address: { '@type': 'PostalAddress', addressCountry: 'DE' },
    });
    expect(
      locationSalaryJsonLd({ ...location, adminLevel: 'region' } as never),
    ).toBeNull();
  });

  it('crossAxisSalaryJsonLd names the place-scoped distributions with lexicon seniority labels', () => {
    const ld = crossAxisSalaryJsonLd('de', {
      name: 'Robotics Engineering',
      placeName: 'Berlin',
      countryCode: 'DE',
      currency: 'USD',
      overall: { avgMin: 90000, avgMax: 130000, p25Min: null, p75Max: null },
      bySeniority: [
        { seniority: 'executive', avgSalaryMin: 140000, avgSalaryMax: 180000 },
      ],
    })!;
    const dists = ld.estimatedSalary as Array<Record<string, unknown>>;
    expect(ld.name).toBe('Robotics Engineering salary in Berlin');
    expect(dists[0]!.percentile25).toBeUndefined();
    expect(dists[1]!.name).toBe('Führungskraft Robotics Engineering in Berlin');
  });

  it('companySalaryJsonLd + companyCategorySalaryJsonLd mirror the hosted employer shapes', () => {
    const company = companySalaryJsonLd('en', {
      companyName: 'Acme Robotics',
      currency: 'USD',
      boardMedianMin: 90000,
      boardMedianMax: 110001,
      boardP25Min: 80000,
      boardP75Max: 150000,
      overallSalary: { avgMin: 90000, avgMax: 130000, jobCount: 15 },
      bySeniority: BY_SENIORITY,
    } as never)!;
    expect(company['@type']).toBe('OccupationAggregationByEmployer');
    expect(company.sampleSize).toBe(15);
    const base = (
      company.estimatedSalary as Array<Record<string, unknown>>
    )[0]!;
    expect(base.name).toBe('base');
    expect(base.median).toBe(100001);
    expect(
      (company.estimatedSalary as Array<Record<string, unknown>>)[1]!.name,
    ).toBe('Senior salary');

    const category = companyCategorySalaryJsonLd('en', {
      companyName: 'Acme Robotics',
      categoryName: 'Robotics Engineering',
      currency: 'USD',
      boardCategoryP25Min: 80000,
      boardCategoryP75Max: 150000,
      overallSalary: { avgMin: 90000, avgMax: 130000, jobCount: 6 },
      bySeniority: BY_SENIORITY,
    } as never)!;
    expect(category.name).toBe('Robotics Engineering at Acme Robotics');
    expect(category.occupationalCategory).toBe('Robotics Engineering');
    expect(
      (category.estimatedSalary as Array<Record<string, unknown>>)[1]!.name,
    ).toBe('Senior Robotics Engineering');
  });
});

describe('listingHead', () => {
  it('builds the counted title, description, OG set, and canonical', () => {
    const head = listingHead({
      boardName: 'Acme Jobs',
      origin: 'https://acme.example.com',
      path: '/jobs/robotics',
      heading: 'Robotics jobs in Berlin',
      count: 42,
    });
    const title = '42 Robotics jobs in Berlin | Acme Jobs';
    const description = 'Browse 42 robotics jobs in berlin on Acme Jobs.';
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

  it('omits the count prefix when no count is given (including 0 stays)', () => {
    expect(
      listingHead({
        boardName: 'Acme Jobs',
        origin: 'https://acme.example.com',
        path: '/jobs',
        heading: 'Jobs',
      }).meta[0],
    ).toEqual({ title: 'Jobs | Acme Jobs' });
    expect(
      listingHead({
        boardName: 'Acme Jobs',
        origin: 'https://acme.example.com',
        path: '/jobs',
        heading: 'Jobs',
        count: 0,
      }).meta[0],
    ).toEqual({ title: '0 Jobs | Acme Jobs' });
  });
});

describe('listingJsonLd', () => {
  it('emits the breadcrumb trail and the job ItemList with company-aware URLs', () => {
    const objects = listingJsonLd({
      origin: 'https://acme.example.com',
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Jobs' }],
      jobs: [
        { slug: 'robot-wrangler', company: { slug: 'acme-robotics' } },
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
          {
            '@type': 'ListItem',
            position: 2,
            url: 'https://acme.example.com/jobs/orphan-job',
          },
        ],
      },
    ]);
  });

  it('omits the ItemList without jobs', () => {
    expect(
      listingJsonLd({
        origin: 'https://x.example.com',
        breadcrumbs: [{ name: 'Home', path: '/' }],
      }),
    ).toHaveLength(1);
  });
});
