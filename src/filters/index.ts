/**
 * `@cavuno/board/filters` — the canonical listing-filter vocabulary and URL
 * search-param parsing for jobs-listing routes.
 *
 * One greppable convention across every tenant frontend: the vocabulary
 * arrays mirror the hosted board; seniority URL parsing follows the hosted
 * semantics exactly (trim, lowercase, dedupe — hand-typed URLs are messy).
 *
 * Map parsed filters onto the wire like:
 * ```
 * companySlug: filters.company,
 * seniority: filters.seniority,
 * remoteOption: filters.remoteOption ? [filters.remoteOption] : undefined,
 * ```
 * Company slugs are the URL identity; the API accepts them directly via
 * `companySlug` — never resolve slug→id client-side.
 *
 * Display labels for seniority / sort / remote options are application-owned
 * chrome words — this entry only ships the wire vocabulary and
 * parsers.
 */
import type {
  EmploymentType,
  JobSort,
  RemoteOption,
  Seniority,
} from '../types/jobs';

export const REMOTE_OPTIONS: readonly RemoteOption[] = [
  'on_site',
  'hybrid',
  'remote',
];

/**
 * The employment types the listing FILTER offers (the hosted filter UI's
 * set) — `volunteer`/`other` exist on the wire but are not filter options.
 */
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
];

/** All 8 platform seniority levels — the hosted filter renders the full set as a multi-select. */
export const SENIORITIES: readonly Seniority[] = [
  'entry_level',
  'associate',
  'mid_level',
  'senior',
  'lead',
  'principal',
  'director',
  'executive',
];

// Candidate-facing result ordering. `relevance` is the default
// featured-ranked browse; the explicit sorts order by the field. `oldest` is
// deliberately absent.
export const JOB_SORTS: readonly JobSort[] = [
  'relevance',
  'newest',
  'salary_high',
];

export const DEFAULT_SORT: JobSort = 'relevance';

/** Wire max for `companySlug` / company multi-select. Keep the FIRST N. */
const COMPANY_SLUG_MAX = 10;

export interface ListingFilters {
  q?: string;
  remoteOption?: RemoteOption;
  employmentType?: EmploymentType;
  /** Multi-select (parity with the hosted board's seniority checkboxes). */
  seniority?: Seniority[];
  /**
   * Company filter as PUBLIC SLUGS (the URL identity). Multi-select tolerated
   * in URLs (comma-joined); the hosted UI applies single-replace. Map to the
   * wire as `companySlug` (`jobs.list` query / `jobs.search` filters).
   */
  company?: string[];
  /** Result ordering; absent ⇒ `relevance`. */
  sort?: JobSort;
}

const SENIORITY_LOOKUP: ReadonlySet<string> = new Set(SENIORITIES);

/**
 * Normalise raw seniority input — an array (repeated params) or a
 * comma-string (hand-typed URL) — to valid levels, with the hosted
 * semantics: trim, lowercase, drop unknowns, dedupe preserving order.
 */
export function parseSeniority(raw: unknown): Seniority[] | undefined {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw
      ? raw.split(',')
      : [];

  const result: Seniority[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    // NFC so café (NFC) and café (NFD) are one Set key. toLowerCase (not
    // toLocaleLowerCase) is correct — these are identifiers, not display.
    const normalized = value.trim().toLowerCase().normalize('NFC');
    if (!normalized || seen.has(normalized)) continue;
    if (!SENIORITY_LOOKUP.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized as Seniority);
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Normalise raw company-slug input — an array (repeated params) or a
 * comma-string (hand-typed URL) — with the hosted semantics: trim,
 * lowercase, drop empties, dedupe preserving order, then cap at 10
 * (the wire max; keep FIRST 10). Open value set (no vocabulary).
 */
export function parseCompany(raw: unknown): string[] | undefined {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw
      ? raw.split(',')
      : [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    // NFC so café (NFC) and café (NFD) are one Set key. toLowerCase (not
    // toLocaleLowerCase) is correct — these are identifiers, not display.
    const normalized = value.trim().toLowerCase().normalize('NFC');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= COMPANY_SLUG_MAX) break;
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Validate raw URL search params into the supported listing filters,
 * dropping unknown values (never throwing — listing URLs are public input).
 *
 * @example
 * parseListingFilters({ seniority: 'senior,lead', company: 'acme', sort: 'newest' });
 * // { seniority: ['senior', 'lead'], company: ['acme'], sort: 'newest' }
 */
export function parseListingFilters(
  search: Record<string, unknown>,
): ListingFilters {
  return {
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    remoteOption: REMOTE_OPTIONS.includes(search.remoteOption as RemoteOption)
      ? (search.remoteOption as RemoteOption)
      : undefined,
    employmentType: EMPLOYMENT_TYPES.includes(
      search.employmentType as EmploymentType,
    )
      ? (search.employmentType as EmploymentType)
      : undefined,
    seniority: parseSeniority(search.seniority),
    company: parseCompany(search.company),
    sort: JOB_SORTS.includes(search.sort as JobSort)
      ? (search.sort as JobSort)
      : undefined,
  };
}
