// Generated-spec-backed talent (candidate-profile) types. Response entities
// alias the generated OpenAPI components; the query type stays hand-written.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/**
 * A candidate's public profile — header (name, headline, location, bio, avatar,
 * job-search status) plus their experiences, education, skills, and languages.
 * Only `public` profiles are returned; `jobSearchStatus` is `null` when the
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
};

export type TalentDirectoryListEnvelope = ListEnvelope<TalentDirectoryEntry>;
