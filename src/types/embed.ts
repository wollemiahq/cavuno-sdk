// Query for `board.embed.jobs()` — the embeddable, UNGATED jobs widget.
// Hand-written (the embed route is not registered in the OpenAPI spec):
// mirrors the browse list's facets + geo, plus a free-text `q` keyword.
// Deliberately has NO `category`/`skill` programmatic seeding and NO
// `fields` sparse fieldset. Repeated params are `T[]`.
import type { EmploymentType, RemoteOption, Seniority } from './jobs';

export type EmbedJobsQuery = {
  /** Free-text search query, up to 200 characters. */
  q?: string;
  cursor?: string;
  /** Default 8; values above the embed ceiling of 50 are clamped to 50. */
  limit?: number;
  /** Job catalog page offset; takes precedence over `cursor`. `offset + limit` ≤ 10,000. */
  offset?: number;
  /** Repeated param (up to 10) — OR-matched. Repeat `companyId` per value. */
  companyId?: string[];
  remoteOption?: RemoteOption[];
  /** Built-in types; each matches jobs of that type with no custom type. */
  employmentType?: EmploymentType[];
  /** Custom employment type keys, ORed with `employmentType`. Up to 10. */
  customEmploymentType?: string[];
  seniority?: Seniority[];
  /** Place slug: jobs in the place and the places inside it; unresolvable slugs are ignored. */
  location?: string;
  /**
   * Widen a city or locality `location` to jobs placed in a city or
   * locality within this many km of it (1–250, decimals allowed). Omit for
   * jobs in the place itself. Ignored for region and country places.
   */
  radius?: number;
};
