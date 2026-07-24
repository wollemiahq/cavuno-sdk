/**
 * Google for Jobs `JobPosting` structured data on the `@cavuno/board` wire
 * types, transcribed field-by-field from the hosted board's generator
 * (the hosted board implementation + `job-posting-location-json-ld.ts`) and
 * tested against the hosted behavior.
 *
 * JSON-LD structure is locale-neutral per schema.org — no board-language
 * parameter here; the only display strings are wire values passed through.
 *
 * Named exclusions (hosted behaviours with no wire twin, recorded in the
 * public API contract):
 *   - `board.companyLegalName` — hosted falls back to it for the
 *     organization name between `company.name` and `board.name`; the wire
 *     board context does not expose it.
 *   - `board.companyWebsiteUrl` — hosted falls back to it for `sameAs` when
 *     the company has no website; not on the wire.
 *   - the hosted `job.place`/`locationLabel` jobLocation fallback (used when
 *     a job has no office locations) — the wire `PublicJob` carries no
 *     resolved place geo, only `officeLocations`.
 */
import type { PublicBoard } from '../types/board';
import type { PublicJob } from '../types/jobs';

export type JsonLdObject = Record<string, unknown>;

/** The only board fields JSON-LD needs — keeps callers' shapes flexible. */
export type JsonLdBoard = Pick<PublicBoard, 'name' | 'logoUrl'>;

/** Google's credentialCategory uses space-form values. `no_requirements` is handled upstream. */
const EDUCATION_TO_CREDENTIAL: Record<string, string> = {
  high_school: 'high school',
  associate_degree: 'associate degree',
  bachelor_degree: 'bachelor degree',
  professional_certificate: 'professional certificate',
  postgraduate_degree: 'postgraduate degree',
};

const EMPLOYMENT_TYPE_TO_GOOGLE: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
  temporary: 'TEMPORARY',
  volunteer: 'VOLUNTEER',
  other: 'OTHER',
};

const SALARY_TIMEFRAME_TO_UNIT: Record<string, string> = {
  per_year: 'YEAR',
  per_month: 'MONTH',
  per_week: 'WEEK',
  per_day: 'DAY',
  per_hour: 'HOUR',
};

/**
 * Worldwide-remote jobs must still emit `applicantLocationRequirements`
 * next to TELECOMMUTE (Google requires a location signal), so the hosted
 * board — and this transcription — lists every country it recognises.
 *
 * This is the hosted board's exact country catalog: sorted by English common
 * name, includes `XK` (Kosovo), and excludes `KP` (North Korea). tested
 * against the hosted list so the two cannot drift.
 */
// prettier-ignore
export const ALL_COUNTRY_CODES = [
  'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BA','BW','BV','BR','IO',
  'VG','BN','BG','BF','BI','KH','CM','CA','CV','BQ','KY','CF','TD','CL','CN','CX',
  'CC','CO','KM','CK','CR','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','CD','EC',
  'EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA',
  'GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT',
  'HM','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JP',
  'JE','JO','KZ','KE','KI','XK','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT',
  'LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD',
  'MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG',
  'NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL',
  'PT','PR','QA','CG','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS',
  'SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','KR',
  'SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK',
  'TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','VI','UY','UZ',
  'VU','VA','VE','VN','WF','EH','YE','ZM','ZW',
] as const;

/**
 * Build the Google for Jobs `JobPosting` JSON-LD object for a job detail
 * page, or `null` when nothing renderable remains after pruning. Embed the
 * result in a `<script type="application/ld+json">` tag.
 */
export function createJobPostingJsonLd({
  job,
  board,
  shareUrl,
}: {
  job: PublicJob;
  board: JsonLdBoard;
  shareUrl: string;
}): JsonLdObject | null {
  const educationRequirements = createEducationRequirements(job);
  const experienceRequirements = createExperienceRequirements(job);

  const jsonLd = pruneJsonLd({
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description ?? '',
    identifier: createIdentifier(job, board),
    datePosted: toIsoDate(job.publishedAt),
    validThrough: toIsoDate(job.expiresAt),
    employmentType: job.employmentType
      ? (EMPLOYMENT_TYPE_TO_GOOGLE[job.employmentType] ?? 'OTHER')
      : 'OTHER',
    hiringOrganization: createHiringOrganization(job, board),
    jobLocation: createJobLocation(job),
    jobLocationType: job.remoteOption === 'remote' ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements:
      job.remoteOption === 'remote'
        ? createApplicantLocationRequirements(job)
        : null,
    baseSalary: createBaseSalary(job),
    educationRequirements,
    experienceRequirements,
    experienceInPlaceOfEducation:
      job.experienceInPlaceOfEducation === true &&
      educationRequirements &&
      experienceRequirements
        ? true
        : undefined,
    url: shareUrl,
  });

  if (!jsonLd || Array.isArray(jsonLd) || Object.keys(jsonLd).length === 0) {
    return null;
  }
  return jsonLd as JsonLdObject;
}

function createIdentifier(job: PublicJob, board: JsonLdBoard): JsonLdObject {
  const organizationName = job.company?.name ?? board.name ?? null;
  const identifier: JsonLdObject = { '@type': 'PropertyValue', value: job.id };
  if (organizationName) identifier.name = organizationName;
  return identifier;
}

function createHiringOrganization(
  job: PublicJob,
  board: JsonLdBoard,
): JsonLdObject | null {
  const name = job.company?.name ?? board.name ?? null;
  if (!name) return null;

  const organization: JsonLdObject = { '@type': 'Organization', name };
  const website = job.company?.website ?? null;
  const normalizedWebsite = website ? normalizeWebsiteUrl(website) : null;
  if (normalizedWebsite) organization.sameAs = normalizedWebsite;
  const logo = job.company?.logoUrl ?? board.logoUrl ?? null;
  if (logo) organization.logo = logo;
  return organization;
}

/**
 * Prefix `https://` onto scheme-less company websites; `null` for
 * blank input (hosted shape — a whitespace-only website never becomes
 * a bare `https://` `sameAs`).
 */
// Sibling of blog.ts normalizeUrl — deliberately NO URL() round-trip (no
// trailing-slash canonicalization): hosted company sameAs keeps the bare form.
export function normalizeWebsiteUrl(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function createBaseSalary(job: PublicJob): JsonLdObject | null {
  const currency = job.salaryCurrency?.trim();
  const hasMin = typeof job.salaryMin === 'number';
  const hasMax = typeof job.salaryMax === 'number';
  if (!currency || (!hasMin && !hasMax)) return null;

  const value: JsonLdObject = { '@type': 'QuantitativeValue' };
  if (hasMin) value.minValue = job.salaryMin;
  if (hasMax) value.maxValue = job.salaryMax;

  const unitText = job.salaryTimeframe
    ? SALARY_TIMEFRAME_TO_UNIT[job.salaryTimeframe]
    : undefined;
  if (unitText) value.unitText = unitText;

  if (!hasMin && hasMax && typeof job.salaryMax === 'number') {
    value.value = job.salaryMax;
    value.minValue = job.salaryMax;
  } else if (!hasMax && hasMin && typeof job.salaryMin === 'number') {
    value.value = job.salaryMin;
    value.maxValue = job.salaryMin;
  }

  return { '@type': 'MonetaryAmount', currency: currency.toUpperCase(), value };
}

function createJobLocation(
  job: PublicJob,
): JsonLdObject | JsonLdObject[] | null {
  const places = job.officeLocations
    .map((office) =>
      createPlaceJsonLd({
        countryCode: office.countryCode,
        region: office.region,
        locality: office.city ?? office.locality,
        postalCode: office.postalCode,
        name: office.displayName,
      }),
    )
    .filter((place): place is JsonLdObject => place !== null);

  if (places.length === 0) return null;
  return places.length === 1 ? places[0]! : places;
}

function createPlaceJsonLd({
  countryCode,
  region,
  locality,
  postalCode,
  name,
}: {
  countryCode?: string | null;
  region?: string | null;
  locality?: string | null;
  postalCode?: string | null;
  name?: string | null;
}): JsonLdObject | null {
  const address: JsonLdObject = { '@type': 'PostalAddress' };
  const country = countryCode?.trim();
  const reg = region?.trim();
  const loc = locality?.trim();
  const postal = postalCode?.trim();
  const placeName = name?.trim();

  if (country) address.addressCountry = country.toUpperCase();
  if (reg) address.addressRegion = reg;
  if (loc) address.addressLocality = loc;
  if (postal) address.postalCode = postal;

  const hasAddressDetails = Object.keys(address).length > 1;
  if (!hasAddressDetails && !placeName) return null;

  const place: JsonLdObject = { '@type': 'Place' };
  if (placeName) place.name = placeName;
  if (hasAddressDetails) place.address = address;
  return place;
}

function createApplicantLocationRequirements(
  job: PublicJob,
): JsonLdObject | JsonLdObject[] | null {
  if (job.remoteWorldwide) {
    return ALL_COUNTRY_CODES.map((code) => ({
      '@type': 'Country',
      name: code,
    }));
  }

  const entries: JsonLdObject[] = [];
  const seen = new Set<string>();

  for (const code of job.remoteWorkPermitCountryCodes ?? []) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({ '@type': 'Country', name: normalized });
  }

  for (const subdivision of job.remoteWorkPermitSubdivisionCodes ?? []) {
    const countryCode = subdivision?.split('-')[0]?.trim().toUpperCase();
    if (!countryCode || seen.has(countryCode)) continue;
    seen.add(countryCode);
    entries.push({ '@type': 'Country', name: countryCode });
  }

  if (entries.length === 0) return null;
  return entries.length === 1 ? entries[0]! : entries;
}

function createEducationRequirements(
  job: PublicJob,
): JsonLdObject[] | string | null {
  const requirements = job.educationRequirements;
  if (!requirements || requirements.length === 0) return null;
  if (requirements.includes('no_requirements')) return 'no requirements';

  const credentials = requirements
    .filter((value) => value in EDUCATION_TO_CREDENTIAL)
    .map((value) => ({
      '@type': 'EducationalOccupationalCredential' as const,
      credentialCategory: EDUCATION_TO_CREDENTIAL[value]!,
    }));
  return credentials.length > 0 ? credentials : null;
}

function createExperienceRequirements(
  job: PublicJob,
): JsonLdObject | string | null {
  const months = job.experienceMonths;
  if (typeof months !== 'number') return null;
  if (months === 0) return 'no requirements';
  return {
    '@type': 'OccupationalExperienceRequirements',
    monthsOfExperience: months,
  };
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function pruneJsonLd(value: unknown): unknown {
  const keep = (entry: unknown) => {
    if (entry == null) return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === 'object')
      return Object.keys(entry as Record<string, unknown>).length > 0;
    return true;
  };

  if (Array.isArray(value)) {
    return value.map((entry) => pruneJsonLd(entry)).filter(keep);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, pruneJsonLd(entry)] as const)
      .filter(([, entry]) => keep(entry));
    return Object.fromEntries(entries);
  }
  return value;
}
