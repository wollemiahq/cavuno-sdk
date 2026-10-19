// Generated-spec-backed talent (candidate-profile) types. Response entities
// alias the generated OpenAPI components; the query type stays hand-written.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';
import type { CustomFieldFilter, ObjectReferenceFilter } from './jobs';

/**
 * A candidate's public profile — header (name, headline, location, bio, avatar,
 * job-search status) plus their experiences, education, skills, and languages.
 * Anonymous callers get `public` profiles; a signed-in board user also gets
 * `logged_in_only` ones. `jobSearchStatus` is `null` when the
 * candidate scoped it to employers only.
 */
export type TalentProfile = Schemas['TalentProfile'];

/**
 * A candidate card in the public talent directory. On cards and profiles,
 * `lastActive` is a coarse bucket (`today`, `this_week`, `this_month`,
 * `last_3_months`, `over_3_months`) returned only to a signed-in employer on
 * the board, for candidates who are actively looking or open to offers;
 * `null` for everyone else.
 */
export type TalentDirectoryEntry = Schemas['TalentDirectoryEntry'];

export type TalentDirectoryQuery = {
  cursor?: string;
  /** Free-text search (name / headline / skills). */
  q?: string;
  /** Filter to candidates listing a given skill. */
  skill?: string;
  /** 1–100, default 20. */
  limit?: number;
  /**
   * Directory page offset (candidates to skip); takes precedence over
   * `cursor`. Pair with the response `count` to page in parallel.
   */
  offset?: number;
  jobSearchStatus?: 'actively_looking' | 'open_to_offers' | 'not_looking';
  /** Comma-separated language names. */
  languages?: string;
  /**
   * `'true'`: candidates open to relocate. `'false'`: everyone else,
   * including candidates who have not answered. Cards and profiles do not
   * include the answer.
   */
  openToRelocate?: 'true' | 'false';
  /**
   * Place slug: candidates whose home is the place or lies within it.
   * Ignored until the board's talent index carries home places.
   */
  place?: string;
  /**
   * Widen a city or locality `place` to candidates whose home city or
   * locality is within this many km of it (1–250, decimals allowed). Omit
   * for candidates in the place itself. Ignored for region and country
   * places, and without `place`. For a place from `taxonomy.places.suggest()`,
   * an omitted radius uses the place's own default distance (15 km
   * neighbourhood, 25 km town, 50 km city).
   */
  radius?: number;
  sort?: 'relevance' | 'newest';
  seniority?: string;
  permitCountry?: string;
  interestedRole?: string;
  customFields?: CustomFieldFilter[];
  objectReferences?: ObjectReferenceFilter[];
};

export type TalentDirectoryListEnvelope = ListEnvelope<TalentDirectoryEntry>;

/**
 * A place the board's directory candidates live in, with how many of them
 * the viewer can see there: a candidate counts in their home place and every
 * place above it. Its `slug` is the directory's `place` filter value.
 */
export type TalentPlace = Schemas['PublicTalentPlace'];

export type TalentPlacesQuery = {
  /**
   * Location search, as on `taxonomy.places.list`: ≥2 chars → places whose
   * name contains it or whose slug starts with it, ranked; under 2 → empty.
   */
  q?: string;
  /** 1–500, default 100, busiest first. With `q`: default 10, at most 50. */
  limit?: number;
};

export type TalentPlacesListEnvelope = ListEnvelope<TalentPlace>;
