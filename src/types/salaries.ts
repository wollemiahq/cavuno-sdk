// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response entities alias the generated components;
// the query type stays hand-written (no serializer to drift from).
import type { Schemas } from './_spec';

/** A job title's salary breakdown (overall + by-seniority + top rails). */
export type TitleSalaryDetail = Schemas['TitleSalaryDetail'];

/** A skill's salary breakdown. */
export type SkillSalaryDetail = Schemas['SkillSalaryDetail'];

/** A place's salary breakdown (city overall + siblings, or area child cities). */
export type LocationSalaryDetail = Schemas['LocationSalaryDetail'];

/** A company on the `/salaries/companies` hub (ranked by sample size). */
export type SalaryCompany = Schemas['SalaryCompanyIndexItem'];

/** A job title on the `/salaries/titles` index. */
export type SalaryTitle = Schemas['SalaryTitleIndexItem'];

/** A skill on the `/salaries/skills` index. */
export type SalarySkill = Schemas['SalarySkillIndexItem'];

/**
 * A place on the `/salaries/locations` index — a flattened tree node carrying
 * its `parentSlug` (the consumer rebuilds the country → region → city browse).
 */
export type SalaryLocation = Schemas['SalaryLocationIndexItem'];

// ──  cross-axis ──────────────────────────────────────────────────────

/** A title's salary across locations (flattened `parentSlug` tree). */
export type TitleLocationsIndex = Schemas['TitleLocationsIndex'];
/** A skill's salary across locations. */
export type SkillLocationsIndex = Schemas['SkillLocationsIndex'];
/** A place's salary by title (suffix read-model). */
export type LocationTitlesIndex = Schemas['LocationTitlesIndex'];
/** A place's salary by skill. */
export type LocationSkillsIndex = Schemas['LocationSkillsIndex'];
/** A title's salary in one place (4 source + canonical slugs). */
export type TitleLocationSalary = Schemas['TitleLocationSalary'];
/** A skill's salary in one place. */
export type SkillLocationSalary = Schemas['SkillLocationSalary'];

/**
 * Board-language overlay for a salary read. `en` (the default) is the identity
 * fast-path; a non-`en` locale overlays board-language names + canonical slugs.
 */
export type SalaryDetailQuery = {
  locale?: string;
};
