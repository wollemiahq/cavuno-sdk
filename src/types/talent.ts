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

/** A candidate card in the public talent directory. */
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
   * places, and without `place`.
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
