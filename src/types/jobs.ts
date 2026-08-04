// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// `scripts/gen-types.ts`. Response entities + the search body alias the
// generated components; the value-enums + nested shapes are derived from
// `PublicJob` so they narrow in lock-step. The query types stay
// hand-written (they have no serializer to drift from) — the repeated
// params are `T[]` per the spec's array rendering.

import type { Schemas } from './_spec';
import type { ListEnvelope, SearchEnvelope } from './common';

export type PublicJob = Schemas['PublicJob'];
export type PublicJobCard = Schemas['PublicJobCard'];

/**
 * A job's opaque, display-only custom-field values, keyed by each
 * field's `key`. Resolve labels via the board's job `CustomFieldDefinition`s
 * (`board.context().customFields.job`).
 */
export type CustomFieldValues = PublicJob['customFieldValues'];
export type CustomFieldValue = CustomFieldValues[string];

export type JobCompany = Schemas['JobCompany'];
export type OfficeLocation = Schemas['JobOfficeLocation'];

export type RemoteOption = NonNullable<PublicJob['remoteOption']>;
export type EmploymentType = NonNullable<PublicJob['employmentType']>;
export type Seniority = NonNullable<PublicJob['seniority']>;
/** Candidate-facing result ordering; `relevance` is the default. */
export type JobSort = NonNullable<Schemas['PublicSearchJobsBody']['sort']>;
export type EducationRequirement = PublicJob['educationRequirements'][number];

export type RemotePermit = PublicJob['remotePermits'][number];
export type RemoteTimezone = PublicJob['remoteTimezones'][number];

/**
 * Derived suggestion on a browse list: jobs surface `category`
 * and `skill` terms; the companies list surfaces `market` terms.
 */
export interface RelatedSearch {
  type: 'category' | 'skill' | 'market';
  slug: string;
  term: string;
  count: number;
}

/** The browse list envelope — `PublicJobCard`s + job catalog pagination + `relatedSearches`. */
export type JobCardListEnvelope = ListEnvelope<PublicJobCard> & {
  relatedSearches?: RelatedSearch[];
};

/** The search envelope — `PublicJobCard`s + job catalog pagination. */
export type JobCardSearchEnvelope = SearchEnvelope<PublicJobCard>;

export type JobsListQuery = {
  cursor?: string;
  /** 1–100. */
  limit?: number;
  /** Job catalog page offset; takes precedence over `cursor`. `offset + limit` ≤ 10,000. */
  offset?: number;
  /** Repeated param (up to 10) — OR-matched. Repeat `companyId` per value. */
  companyId?: string[];
  /**
   * Company slugs (the public URL identity). Repeat for multiple values
   * (up to 10). Resolved server-side; unknown slugs are dropped. Combined
   * with `companyId` as a union. If the provided company filter resolves
   * to no known companies, the result is empty.
   */
  companySlug?: string[];
  remoteOption?: RemoteOption[];
  employmentType?: EmploymentType[];
  seniority?: Seniority[];
  /** Result ordering. Absent ⇒ `relevance` (the featured-ranked browse). */
  sort?: JobSort;
  /** Place slug for a geo radius search; unresolvable slugs are ignored. */
  location?: string;
  /** Radius in km around `location` (10–250; default 50). */
  radius?: number;
  /** Category slug seed (the `/jobs/[keyword]` page) — server resolves it to the English source name; unresolvable → 404. */
  category?: string;
  /** Skill slug seed (the `/jobs/skills/[skill]` page) — server-resolved; unresolvable → 404. */
  skill?: string;
  /** Sparse fieldset (Medusa-style `+field`). Only `'+description'` is supported — adds `description` to each card. */
  fields?: string;
};

export type JobsSimilarQuery = {
  /** How many similar jobs to return (1–20; default 5). */
  limit?: number;
};

export type JobsSearchBody = Schemas['PublicSearchJobsBody'];
