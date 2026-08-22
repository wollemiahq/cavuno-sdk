/**
 * Salary-page helpers — the hosted salary-page formatters plus the
 * `Occupation`/`MonetaryAmountDistribution`/`ItemList`/`FAQPage` structured
 * data the salary surfaces emit.
 *
 * The formatters (`formatSalaryStat`/`formatSalaryStatRange` +
 * `SENIORITY_ORDER`/`sortBySeniority`) and the structured-data builders
 * transcribe the hosted salary surfaces and are tested against them
 * . Currency is a required parameter — the salary detail types
 * carry `currency` beside the amounts. Per  the board language is
 * the REQUIRED leading parameter on formatters.
 *
 * Rule: the SDK formats with `Intl` and returns structure; it never picks
 * words. JSON-LD `name` fields are data labels (entity / category names).
 * Per-seniority distribution names are application-owned via
 * `seniorityName({ seniority, entity })` — when omitted, the distribution
 * ships without a `name`. The app composes the finished string so word
 * order (and spacing) are locale-correct. FAQ helpers return entry kinds +
 * values; the application composes questions and answers from its catalog.
 */
import { normalizeLocale } from '../format/locale';
import { formatNumberRange, type NumberNotation } from '../format/salary-range';

import type { CompanyCategorySalary, CompanySalary } from '../types/companies';
import type {
  LocationSalaryDetail,
  SkillSalaryDetail,
  TitleSalaryDetail,
} from '../types/salaries';
import type { JsonLdObject } from './job-posting';

export type { NumberNotation };

const currencyFormatterCache = new Map<string, Intl.NumberFormat | null>();

/**
 * Compact only where it shortens — same magnitude rule as
 * `formatSalaryRange`. `$90K` vs `$90,000` is register, not locale; the
 * caller may force either. ICU's en compact form starts at 1000.
 */
function notationForMagnitude(
  ...values: Array<number | null | undefined>
): NumberNotation {
  let anyFinite = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    anyFinite = true;
    if (Math.abs(v) >= 1000) return 'compact';
  }
  return anyFinite ? 'standard' : 'compact';
}

function getCurrencyFormatter(
  language: string,
  currencyCode: string,
  notation: NumberNotation,
): Intl.NumberFormat | null {
  const key = `${language}:${currencyCode}:${notation}`;
  const cached = currencyFormatterCache.get(key);
  if (cached !== undefined) return cached;

  let formatter: Intl.NumberFormat | null;
  try {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode,
      notation,
    };
    if (notation === 'compact') {
      // Digit cap only while compacting — do not apply these fraction
      // overrides to standard notation (USD 2, KWD/BHD 3, JPY 0 CLDR).
      options.compactDisplay = 'short';
      options.minimumFractionDigits = 0;
      options.maximumFractionDigits = 1;
    }
    formatter = new Intl.NumberFormat(language, options);
  } catch {
    formatter = null;
  }
  currencyFormatterCache.set(key, formatter);
  return formatter;
}

/**
 * Salary amount in the board language and the job's currency
 * (`$90K`, `$90,000.00`, `90.000 €`, …) — the hosted salary-page money
 * formatter with locale-driven digits/grouping and a real currency code.
 *
 * `notation` matches `formatSalaryRange`: omit to pick by magnitude
 * (`|value| ≥ 1000` → compact; smaller → standard so hourly/day rates keep
 * CLDR minor units). Pass `'standard'` for full figures (`$90,000`) or
 * `'compact'` to force short form. Compact vs standard is register (hero
 * card vs FAQ prose), not locale.
 *
 * Empty/missing/`null` currency is not USD — returns `null` (same stance as
 * `job-posting` omitting `baseSalary`). When `Intl` rejects the locale or
 * currency, or the value is non-finite (`NaN` / `±Infinity`), returns `null`
 * rather than English `M`/`k` abbreviations, a bare `$`, or a literal `$NaN`.
 */
export function formatSalaryStat(
  locale: string,
  value: number,
  currency: string | null | undefined,
  notation?: NumberNotation,
): string | null {
  if (!Number.isFinite(value)) return null;
  // Match formatSalaryRange: optional-chain so a runtime null/undefined
  // (wire types claim string; consumers still pass null) returns null,
  // never TypeError on `.trim()`.
  const currencyCode = currency?.trim().toUpperCase() || null;
  if (!currencyCode) return null;
  const normalized = normalizeLocale(locale);
  if (!normalized) return null;
  const resolved = notation ?? notationForMagnitude(value);
  const formatter = getCurrencyFormatter(normalized, currencyCode, resolved);
  if (!formatter) return null;
  return formatter.format(value);
}

/**
 * Salary range via `Intl.NumberFormat.prototype.formatRange` so the
 * locale owns separator, repeated currency/magnitude, and bidi marks.
 * Returns `null` when currency is empty/null, either bound is non-finite, or
 * `Intl` rejects the inputs.
 *
 * `notation` matches `formatSalaryRange` / `formatSalaryStat` (magnitude
 * default when omitted). Pass `'standard'` for full-figure ranges used in
 * FAQ prose (`$100,000 – $150,000`); default compact suits hero cards.
 *
 * When `min === max` the figure is a fixed salary, not a range: format a
 * single amount. ICU's `formatRange(X, X)` emits `approximatelySign`
 * (`~$140K`) because a degenerate range is not silently flattened — correct
 * for "about X", wrong for a pin where min and max are the same posted
 * salary.
 */
export function formatSalaryStatRange(
  locale: string,
  min: number,
  max: number,
  currency: string | null | undefined,
  notation?: NumberNotation,
): string | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const currencyCode = currency?.trim().toUpperCase() || null;
  if (!currencyCode) return null;
  const normalized = normalizeLocale(locale);
  if (!normalized) return null;
  // notationForMagnitude is order-insensitive (checks abs magnitude only).
  const resolved = notation ?? notationForMagnitude(min, max);
  const formatter = getCurrencyFormatter(normalized, currencyCode, resolved);
  if (!formatter) return null;
  // Inverted bounds (min > max): swap rather than emit `$120–90K`. ICU
  // formatRange happily prints descending ranges; transposed feed columns
  // still carry a real salary. formatSalaryRange does the same.
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  // Fixed salary (min === max): single amount, not ICU's ~approximate form.
  if (low === high) return formatter.format(low);
  return formatNumberRange(formatter, low, high);
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
 * Options shared by salary JSON-LD builders that emit per-seniority
 * distributions. Applications compose the finished distribution `name` —
 * the SDK never invents display words or word order.
 */
export interface SalaryJsonLdOptions {
  /**
   * Composes the finished `MonetaryAmountDistribution.name` for one
   * seniority row. Receives the wire seniority enum (`entry_level`,
   * `senior`, …) and the occupation/entity label (category name, title,
   * …). Return the whole string in board-language order — e.g. French
   * `"Ingénieur logiciel sénior"`, Japanese without a space, English
   * `"Senior Software Engineer"`. When omitted, per-seniority
   * distributions ship without a `name` (valid structured data;
   * wrong-language / wrong-order names are not).
   */
  seniorityName?: (args: { seniority: string; entity: string }) => string;
}

/**
 * One `MonetaryAmountDistribution` entry (yearly unit). `stats` carries the
 * caller's EXACT optional-field semantics — some builders truthy-drop their
 * percentiles, the location page includes nullable percentiles
 * unconditionally — hosted-parity quirks that must stay per-builder.
 * `name` is optional: omit rather than invent an English seniority word.
 */
function distribution(
  name: string | undefined,
  currency: string,
  minValue: number,
  maxValue: number,
  stats: JsonLdObject = {},
): JsonLdObject {
  return {
    '@type': 'MonetaryAmountDistribution',
    ...(name !== undefined ? { name } : {}),
    currency,
    minValue,
    maxValue,
    ...stats,
    ...yearly,
  };
}

/**
 * Per-seniority distributions. When `seniorityName` is supplied, the app
 * composes the finished `name` from wire seniority + entity; when omitted,
 * each distribution ships without a `name`.
 */
function seniorityDistributions(
  rows: { seniority: string; avgSalaryMin: number; avgSalaryMax: number }[],
  currency: string,
  entity: string,
  options?: SalaryJsonLdOptions,
): JsonLdObject[] {
  return rows.map((row) => {
    const name = options?.seniorityName?.({
      seniority: row.seniority,
      entity,
    });
    return distribution(name, currency, row.avgSalaryMin, row.avgSalaryMax);
  });
}

/**
 * Shared envelope for Occupation-shaped salary-page structured data: the
 * null-guard/`@context` skeleton is identical across the four occupation
 * builders; only the `@type`, name, extra top-level fields, and
 * distributions differ.
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

/** Finished FAQ copy ready for `faqJsonLd` (application-composed). */
export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Structured salary FAQ entry — kinds + values, never prose.
 *
 * - `average`: overall range (Intl compact convenience + raw figures) and
 *   sample size for the "what is the average?" question. `range` is a
 *   convenience string; `avgMin` / `avgMax` / `currency` stay so the app can
 *   reformat (e.g. standard notation for prose FAQ answers).
 * - `methodology`: label only; the application writes the calculation
 *   explanation from its catalog.
 *
 * Map each entry to `{ q, a }` with board-language plural rules before
 * calling `faqJsonLd`.
 */
export type SalaryFaqEntry =
  | {
      kind: 'average';
      /**
       * Entity label echoed so FAQ mapping is a pure map over entries —
       * the app does not re-close over the page's category/skill name.
       * The SDK never reads it for formatting.
       */
      label: string;
      /**
       * Convenience compact range from `formatSalaryStatRange`. Prefer
       * `avgMin`/`avgMax`/`currency` when composing full-figure prose.
       * `null` when Intl cannot format (raw figures still present).
       */
      range: string | null;
      avgMin: number;
      avgMax: number;
      currency: string;
      jobCount: number;
    }
  | {
      kind: 'methodology';
      /** Same echo as average — pure map over entries without re-closing. */
      label: string;
    };

/**
 * Salary FAQ *data* for a page that has an overall figure. Returns entry
 * kinds plus values; the application composes questions and answers.
 * Empty when there is no overall figure. Carries raw `avgMin` / `avgMax` /
 * `currency` alongside the compact `range` convenience so FAQ prose can
 * reformat (standard vs compact is register, not locale). Sentences leave
 * the SDK.
 *
 * `label` is echoed on both entries so the application can map kinds →
 * `{ q, a }` without re-threading the entity name from the page scope.
 */
export function buildSalaryFaq(
  locale: string,
  label: string,
  overall: { avgMin: number; avgMax: number; jobCount: number } | null,
  currency: string,
): SalaryFaqEntry[] {
  if (!overall) return [];
  const range = formatSalaryStatRange(
    locale,
    overall.avgMin,
    overall.avgMax,
    currency,
  );
  return [
    {
      kind: 'average',
      label,
      range,
      avgMin: overall.avgMin,
      avgMax: overall.avgMax,
      currency,
      jobCount: overall.jobCount,
    },
    {
      kind: 'methodology',
      label,
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

/** A `FAQPage` from application-composed `{q,a}` items. */
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
 * `Occupation` for a job-title salary page.
 *
 * Names are data labels only (category name). Pass `seniorityName` so the
 * application composes per-seniority distribution names (word order included).
 */
export function titleSalaryJsonLd(
  d: TitleSalaryDetail,
  options?: SalaryJsonLdOptions,
): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope('Occupation', d.categoryName, {}, [
    distribution(
      d.categoryName,
      d.currency,
      d.overallSalary.avgMin,
      d.overallSalary.avgMax,
      {
        ...(d.boardP25Min ? { percentile25: d.boardP25Min } : {}),
        ...(d.boardP75Max ? { percentile75: d.boardP75Max } : {}),
      },
    ),
    ...seniorityDistributions(
      d.bySeniority,
      d.currency,
      d.categoryName,
      options,
    ),
  ]);
}

/** `Occupation` for a skill salary page (overall distribution + median). */
export function skillSalaryJsonLd(d: SkillSalaryDetail): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope('Occupation', d.skillName, {}, [
    distribution(
      d.skillName,
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
 * Options for builders that list occupations present on a non-occupation
 * page (location overview, company salary overview). Callers supply absolute
 * URLs for each occupation's own salary page — that page carries the real
 * Occupation rich result.
 */
export interface SalaryOccupationListOptions {
  /**
   * Absolute URL for an occupation (title / category) row on this page.
   * Required so the ItemList links to pages that carry real Occupation
   * structured data rather than inventing an Occupation for a place or
   * employer.
   */
  occupationUrl: (row: {
    categorySlug: string;
    categoryName: string;
  }) => string;
}

/**
 * `ItemList` of occupations (top categories) on a city-level location
 * salary page. Location and employer overviews are not occupations — they
 * must not claim `schema.org/Occupation`. City-level pages only (hosted
 * gate); `null` when not a city/locality or when there are no category rows.
 */
export function locationSalaryJsonLd(
  d: LocationSalaryDetail,
  options?: SalaryOccupationListOptions,
): JsonLdObject | null {
  // Options required at runtime for real ItemList URLs; omitted → null
  // (match siblings that return null rather than throw TypeError).
  if (!options?.occupationUrl) return null;
  const isCity = d.adminLevel === 'city' || d.adminLevel === 'locality';
  if (!isCity) return null;
  return itemListJsonLd(
    d.topCategories.map((c) => ({
      name: c.categoryName,
      url: options.occupationUrl(c),
    })),
  );
}

/**
 * Cross-axis (title×location / skill×location) `Occupation` JSON-LD. Takes
 * primitives to stay decoupled from the two cross-axis detail wire types.
 *
 * Occupation name is the axis name (data); place lives in
 * `occupationLocation`. Pass `seniorityName` for per-seniority names.
 */
export function crossAxisSalaryJsonLd(
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
  options?: SalaryJsonLdOptions,
): JsonLdObject | null {
  if (!args.overall) return null;
  return salaryEnvelope(
    'Occupation',
    args.name,
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
        args.name,
        args.currency,
        args.overall.avgMin,
        args.overall.avgMax,
        {
          ...(args.overall.p25Min ? { percentile25: args.overall.p25Min } : {}),
          ...(args.overall.p75Max ? { percentile75: args.overall.p75Max } : {}),
        },
      ),
      ...seniorityDistributions(
        args.bySeniority,
        args.currency,
        args.name,
        options,
      ),
    ],
  );
}

/**
 * `ItemList` of occupations (categories) on a company salary overview.
 * An employer is not an occupation — do not emit
 * `OccupationAggregationByEmployer` with the company name as `Occupation.name`.
 * Each list entry links to the category-at-company page that carries the
 * real Occupation structured data. `null` when `byCategory` is empty.
 */
export function companySalaryJsonLd(
  d: CompanySalary,
  options?: SalaryOccupationListOptions,
): JsonLdObject | null {
  // Options required at runtime for real ItemList URLs; omitted → null
  // (match siblings that return null rather than throw TypeError).
  if (!options?.occupationUrl) return null;
  return itemListJsonLd(
    d.byCategory.map((c) => ({
      name: c.categoryName,
      url: options.occupationUrl(c),
    })),
  );
}

/**
 * `Occupation` for one job category at a company (the hosted category page).
 * Occupation name is the category (data); company lives on
 * `hiringOrganization`. Pass `seniorityName` for per-seniority names.
 */
export function companyCategorySalaryJsonLd(
  d: CompanyCategorySalary,
  options?: SalaryJsonLdOptions,
): JsonLdObject | null {
  if (!d.overallSalary) return null;
  return salaryEnvelope(
    'Occupation',
    d.categoryName,
    {
      occupationalCategory: d.categoryName,
      hiringOrganization: { '@type': 'Organization', name: d.companyName },
    },
    [
      distribution(
        d.categoryName,
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
        d.bySeniority,
        d.currency,
        d.categoryName,
        options,
      ),
    ],
  );
}
