// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// `scripts/gen-types.ts`. Response entities + the search body alias the
// generated components; the value-enums + nested shapes are derived from
// `PublicJob` so they narrow in lock-step. The query types stay
// hand-written (they have no serializer to drift from) — the repeated
// params are `T[]` per the spec's array rendering.

import type { Schemas } from './_spec';
import type { ListEnvelope, SearchEnvelope } from './common';

export type JobCollectionChoiceList = Schemas['JobCollectionChoiceList'];
export type JobCollectionFieldDefinition =
  Schemas['JobCollectionFieldDefinition'];
export type ResolvedJobCollectionField = Schemas['ResolvedJobCollectionField'];
export type JobCollectionChoiceQuery = {
  search?: string;
  cursor?: string;
  limit?: number;
};

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
/**
 * A job's custom employment type (e.g. `Casual`): show its `label` in place
 * of the built-in `employmentType`, which is its Google equivalent.
 */
export type JobCustomEmploymentType = NonNullable<
  PublicJob['customEmploymentType']
>;
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
  /** Built-in types; each matches jobs of that type with no custom type. */
  employmentType?: EmploymentType[];
  /**
   * Custom employment type keys (`board.context().jobForm.employmentType
   * .customTypes`), ORed with `employmentType`. Up to 10.
   */
  customEmploymentType?: string[];
  seniority?: Seniority[];
  /** Result ordering. Absent ⇒ `relevance` (the featured-ranked browse). */
  sort?: JobSort;
  /** Place slug: jobs in the place and the places inside it; unresolvable slugs are ignored. */
  location?: string;
  /**
   * Widen a city or locality `location` to jobs placed in a city or
   * locality within this many km of it (1–250, decimals allowed). Omit for
   * jobs in the place itself. Ignored for region and country places. For a
   * place from `taxonomy.places.suggest()`, an omitted radius uses the
   * place's own default distance (15 km neighbourhood, 25 km town, 50 km city).
   */
  radius?: number;
  /**
   * With `location` and no `radius`: widen a city or locality to the market
   * default distance (25 mi in the US, GB, LR and MM; 50 km elsewhere),
   * computed from the resolved place. Regions and countries are not
   * widened; an explicit `radius` wins. Saves resolving the place first to
   * pick the radius. A place from `places.suggest` always uses its own
   * default (15 km neighbourhood, 25 km town, 50 km city), with or without
   * this flag.
   */
  defaultRadius?: boolean;
  /** Category slug seed (the `/jobs/[keyword]` page) — server resolves it to the English source name; unresolvable → 404. */
  category?: string;
  /** Skill slug seed (the `/jobs/skills/[skill]` page) — server-resolved; unresolvable → 404. */
  skill?: string;
  /** Sparse fieldset (Medusa-style `+field`). Only `'+description'` is supported — adds `description` to each card. */
  fields?: string;
  /**
   * Capability opt-ins, sent as the `capabilities` query parameter.
   * `apply-gateway-v1` includes Sponsored jobs, which are left out without
   * it; counts and pagination cover only the jobs returned.
   */
  capabilities?: JobCapability[];
};

/**
 * An opt-in capability token. `apply-gateway-v1` declares that the caller
 * renders opaque Sponsored Apply: `jobs.retrieve` returns the country-gated
 * Apply shape, and the job lists include Sponsored jobs. Without it a
 * Sponsored job is left out of the lists and `jobs.retrieve` returns 404.
 */
export type JobCapability = 'apply-gateway-v1';

export type JobRetrieveQuery = {
  /**
   * Capability opt-ins, sent as the `capabilities` query parameter. Same
   * effect as the `x-cavuno-board-capabilities` header, but the response
   * stays shared-cacheable under its own URL; the header form is never
   * cached.
   */
  capabilities?: JobCapability[];
};

export type JobsSimilarQuery = {
  /** How many similar jobs to return (1–20; default 5). */
  limit?: number;
  /**
   * Capability opt-ins, sent as the `capabilities` query parameter.
   * `apply-gateway-v1` includes Sponsored jobs, which are left out without
   * it; counts and pagination cover only the jobs returned.
   */
  capabilities?: JobCapability[];
};

export type CustomFilterValue = string | number | boolean;
export type CustomFieldFilter = { key: string; values: CustomFilterValue[] };
export type ObjectReferenceFilter = { key: string; recordIds: string[] };

/**
 * The `jobs.search` body, aliased from the spec like the response types.
 * `filters.customFields` matches the job's own custom fields and
 * `filters.companyCustomFields` the public profile fields of the job's
 * company; both take {@link CustomFieldFilter} clauses (the tests pin that
 * the spec shape and `CustomFieldFilter` stay identical).
 */
export type JobsSearchBody = Schemas['PublicSearchJobsBody'];
