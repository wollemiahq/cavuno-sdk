import { getSalaryLexicon } from '../format/salary-lexicon';

import type { CompanyCategorySalary, CompanySalary } from '../types/companies';
import type {
  LocationSalaryDetail,
  SkillSalaryDetail,
  TitleSalaryDetail,
} from '../types/salaries';
/**
 * Salary-page helpers — the hosted salary-page formatters plus the
 * `Occupation`/`MonetaryAmountDistribution`/`ItemList`/`FAQPage` structured
 * data the salary surfaces emit.
 *
 * The formatters (`formatUsd`/`formatRange`/`formatSeniority` +
 * `SENIORITY_ORDER`/`sortBySeniority`) transcribe the hosted
 * the hosted board implementation and are tested against
 * it . Note the hosted quirk, kept deliberately: `formatUsd` is
 * **USD-hardcoded** — the board language only drives number formatting.
 * Per  the board language is the REQUIRED leading parameter
 * (hosted spells it as a trailing `language = 'en'` default).
 *
 * JSON-LD carries RAW salary values (locale-independent). The only
 * localized display strings inside it are the seniority labels
 * (`formatSeniority` → the board-language lexicon); the surrounding
 * English name templates ("… salary (all levels)", "Average Salary in …")
 * mirror the hosted pages, which template them in English on every board.
 *
 * The FAQ ships TEMPLATED (English sentences), documented as interim —
 * board-custom FAQ copy is a not currently available and supersedes the
 * template when available.
 */
import type { JsonLdObject } from './job-posting';

const compactCurrencyCache = new Map<string, Intl.NumberFormat>();

function getCompactCurrencyFormatter(language: string): Intl.NumberFormat {
  const cached = compactCurrencyCache.get(language);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  compactCurrencyCache.set(language, formatter);
  return formatter;
}

/**
 * Compact USD amount in the board language (`$90K`, de: `90.000 $`) — the
 * hosted salary-page money formatter. USD-hardcoded (hosted quirk); the
 * locale drives digits, grouping, and symbol placement only.
 */
export function formatUsd(locale: string, value: number): string {
  try {
    return getCompactCurrencyFormatter(locale).format(value);
  } catch {
    // Fallback
    if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      return `$${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
    }
    if (value >= 1_000) {
      const thousands = value / 1_000;
      return `$${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
    }
    return `$${value}`;
  }
}

/** `formatUsd(min) – formatUsd(max)` with the hosted spaced en dash. */
export function formatRange(locale: string, min: number, max: number): string {
  return `${formatUsd(locale, min)} – ${formatUsd(locale, max)}`;
}

/**
 * Seniority display label. Precedence (hosted shape): owner override >
 * board-language lexicon (en = the English source labels) > title-case
 * fallback for an unknown key.
 */
export function formatSeniority(
  locale: string,
  value: string,
  overrides?: Record<string, string>,
): string {
  if (overrides?.[value]) {
    return overrides[value];
  }
  const lexiconLabel = (
    getSalaryLexicon(locale).seniority as Record<string, string>
  )[value];
  if (lexiconLabel) {
    return lexiconLabel;
  }
  // Fallback: title-case the raw value
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** The canonical seniority ladder order the hosted salary pages sort by. */
export const SENIORITY_ORDER = [
  'entry_level',
  'associate',
  'mid_level',
  'senior',
  'lead',
  'principal',
  'director',
  'executive',
] as const;

/** Sort rows by `SENIORITY_ORDER` (unknown keys sink to the end). Non-mutating. */
export function sortBySeniority<T extends { seniority: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aIdx = SENIORITY_ORDER.indexOf(
      a.seniority as (typeof SENIORITY_ORDER)[number],
    );
    const bIdx = SENIORITY_ORDER.indexOf(
      b.seniority as (typeof SENIORITY_ORDER)[number],
    );
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
}

const yearly = {
  unitText: 'YEAR' as const,
  duration: 'P1Y' as const,
};

/**
 * One `MonetaryAmountDistribution` entry (yearly unit). `stats` carries the
 * caller's EXACT optional-field semantics — some builders truthy-drop their
 * percentiles, the location page includes nullable percentiles
 * unconditionally — hosted-parity quirks that must stay per-builder.
 */
function distribution(
  name: string,
  currency: string,
  minValue: number,
  maxValue: number,
  stats: JsonLdObject = {},
): JsonLdObject {
  return {
    '@type': 'MonetaryAmountDistribution',
    name,
    currency,
    minValue,
    maxValue,
    ...stats,
    ...yearly,
  };
}

/** The shared per-seniority distribution mapping (board-language labels). */
function seniorityDistributions(
  locale: string,
  rows: { seniority: string; avgSalaryMin: number; avgSalaryMax: number }[],
  currency: string,
  nameFor: (seniorityLabel: string) => string,
): JsonLdObject[] {
  return rows.map((row) =>
    distribution(
      nameFor(formatSeniority(locale, row.seniority)),
      currency,
      row.avgSalaryMin,
      row.avgSalaryMax,
    ),
  );
}

/**
 * Shared envelope for the salary-page structured-data builders: the
 * null-guard/`@context` skeleton is identical across all six; only the
 * `@type`, name, extra top-level fields, and distributions differ.
 */
function salaryEnvelope(
  type: 'Occupation' | 'OccupationAggregationByEmployer',
  name: string,
  extra: JsonLdObject,
  estimatedSalary: JsonLdObject[],
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    ...extra,
    estimatedSalary,
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * A templated salary FAQ (interim — see the module doc). The sentences are
 * English; the embedded range is board-language-formatted via `formatRange`
 * (the only part hosted localizes). Empty when there is no overall figure.
 */
export function buildSalaryFaq(
  locale: string,
  label: string,
  overall: { avgMin: number; avgMax: number; jobCount: number } | null,
): FaqItem[] {
  if (!overall) return [];
  const range = formatRange(locale, overall.avgMin, overall.avgMax);
  return [
    {
      q: `What is the average salary for ${label}?`,
      a: `The average salary for ${label} is ${range} per year, based on ${overall.jobCount} job ${overall.jobCount === 1 ? 'posting' : 'postings'} on this board that disclose pay.`,
    },
    {
      q: `How is the salary figure for ${label} calculated?`,
      a: `These figures are aggregated from current and recent job postings on this board that disclose pay, then averaged across roles. They are estimates, not guarantees of compensation.`,
    },
  ];
}

/** An `ItemList` for a salary index page (the listing's items + their URLs). */
export function itemListJsonLd(
  items: { name: string; url: string }[],
): JsonLdObject | null {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/** A `FAQPage` from `buildSalaryFaq` items (or any `{q,a}` list). */
export function faqJsonLd(faqs: FaqItem[]): JsonLdObject | null {
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * `Occupation` for a job-title salary page. Per-seniority distribution
 * names embed the board-language seniority label (`formatSeniority`).
 */
export function titleSalaryJsonLd(
  locale: string,
  d: TitleSalaryDetail,
): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope('Occupation', d.categoryName, {}, [
    distribution(
      `${d.categoryName} salary (all levels)`,
      d.currency,
      d.overallSalary.avgMin,
      d.overallSalary.avgMax,
      {
        ...(d.boardP25Min ? { percentile25: d.boardP25Min } : {}),
        ...(d.boardP75Max ? { percentile75: d.boardP75Max } : {}),
      },
    ),
    ...seniorityDistributions(
      locale,
      d.bySeniority,
      d.currency,
      (label) => `${label} ${d.categoryName}`,
    ),
  ]);
}

/** `Occupation` for a skill salary page (overall distribution + median). */
export function skillSalaryJsonLd(d: SkillSalaryDetail): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope('Occupation', d.skillName, {}, [
    distribution(
      `${d.skillName} salary (all levels)`,
      d.currency,
      d.overallSalary.avgMin,
      d.overallSalary.avgMax,
      {
        median: Math.round(
          (d.overallSalary.medianMin + d.overallSalary.medianMax) / 2,
        ),
      },
    ),
  ]);
}

/**
 * `Occupation` for a location salary page. City-level pages only (the
 * hosted page gates on city/locality); `null` otherwise.
 */
export function locationSalaryJsonLd(
  d: LocationSalaryDetail,
): JsonLdObject | null {
  const isCity = d.adminLevel === 'city' || d.adminLevel === 'locality';
  if (!isCity || !d.overallSalary) return null;
  return salaryEnvelope(
    'Occupation',
    `Average Salary in ${d.placeName}`,
    {
      occupationLocation: {
        '@type': 'City',
        name: d.placeName,
        address: { '@type': 'PostalAddress', addressCountry: d.countryCode },
      },
    },
    [
      distribution(
        `Average salary in ${d.placeName}`,
        d.currency,
        d.overallSalary.avgMin,
        d.overallSalary.avgMax,
        {
          median: Math.round(
            (d.overallSalary.medianMin + d.overallSalary.medianMax) / 2,
          ),
          // Hosted includes these unconditionally, nulls and all.
          percentile25: d.overallSalary.p25Min,
          percentile75: d.overallSalary.p75Max,
        },
      ),
    ],
  );
}

/**
 * Cross-axis (title×location / skill×location) `Occupation` JSON-LD. Takes
 * primitives to stay decoupled from the two cross-axis detail wire types.
 */
export function crossAxisSalaryJsonLd(
  locale: string,
  args: {
    name: string;
    placeName: string;
    countryCode: string;
    overall: {
      avgMin: number;
      avgMax: number;
      p25Min: number | null;
      p75Max: number | null;
    } | null;
    bySeniority: {
      seniority: string;
      avgSalaryMin: number;
      avgSalaryMax: number;
    }[];
    currency: string;
  },
): JsonLdObject | null {
  if (!args.overall) return null;
  return salaryEnvelope(
    'Occupation',
    `${args.name} salary in ${args.placeName}`,
    {
      occupationLocation: {
        '@type': 'AdministrativeArea',
        name: args.placeName,
        address: {
          '@type': 'PostalAddress',
          addressCountry: args.countryCode,
        },
      },
    },
    [
      distribution(
        `${args.name} salary in ${args.placeName} (all levels)`,
        args.currency,
        args.overall.avgMin,
        args.overall.avgMax,
        {
          ...(args.overall.p25Min ? { percentile25: args.overall.p25Min } : {}),
          ...(args.overall.p75Max ? { percentile75: args.overall.p75Max } : {}),
        },
      ),
      ...seniorityDistributions(
        locale,
        args.bySeniority,
        args.currency,
        (label) => `${label} ${args.name} in ${args.placeName}`,
      ),
    ],
  );
}

/**
 * `OccupationAggregationByEmployer` for a company's salary overview —
 * mirrors the hosted company-salary page's Google-salary structured data
 * (base + per-seniority distributions, the board median/IQR baseline as
 * the aggregate stats).
 */
export function companySalaryJsonLd(
  locale: string,
  d: CompanySalary,
): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope(
    'OccupationAggregationByEmployer',
    `Jobs at ${d.companyName}`,
    {
      sampleSize: d.overallSalary.jobCount,
      hiringOrganization: { '@type': 'Organization', name: d.companyName },
    },
    [
      distribution(
        'base',
        d.currency,
        d.overallSalary.avgMin,
        d.overallSalary.avgMax,
        {
          ...(d.boardMedianMin && d.boardMedianMax
            ? { median: Math.round((d.boardMedianMin + d.boardMedianMax) / 2) }
            : {}),
          ...(d.boardP25Min ? { percentile25: d.boardP25Min } : {}),
          ...(d.boardP75Max ? { percentile75: d.boardP75Max } : {}),
        },
      ),
      ...seniorityDistributions(
        locale,
        d.bySeniority,
        d.currency,
        (label) => `${label} salary`,
      ),
    ],
  );
}

/** `Occupation` for one job category at a company (the hosted category page). */
export function companyCategorySalaryJsonLd(
  locale: string,
  d: CompanyCategorySalary,
): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope(
    'Occupation',
    `${d.categoryName} at ${d.companyName}`,
    {
      occupationalCategory: d.categoryName,
      hiringOrganization: { '@type': 'Organization', name: d.companyName },
    },
    [
      distribution(
        `${d.categoryName} salary (all levels)`,
        d.currency,
        d.overallSalary.avgMin,
        d.overallSalary.avgMax,
        {
          ...(d.boardCategoryP25Min
            ? { percentile25: d.boardCategoryP25Min }
            : {}),
          ...(d.boardCategoryP75Max
            ? { percentile75: d.boardCategoryP75Max }
            : {}),
        },
      ),
      ...seniorityDistributions(
        locale,
        d.bySeniority,
        d.currency,
        (label) => `${label} ${d.categoryName}`,
      ),
    ],
  );
}
