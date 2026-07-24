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
  employmentType?: EmploymentType[];
  seniority?: Seniority[];
  /** Place slug for a geo radius search; unresolvable slugs are ignored. */
  location?: string;
  /** Radius in km around `location` (10–250; default 50). */
  radius?: number;
};
