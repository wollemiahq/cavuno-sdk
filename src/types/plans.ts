// Generated-spec-backed plan (employer-pricing) types. Response entities alias
// the generated OpenAPI components; the query type stays hand-written.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/**
 * A board plan (employer or job-seeker pricing). `purpose` says what the plan
 * entitles; `pricingMode` says how it is bought — a `contact` plan is
 * quote-only, so render `priceText` and the CTA fields instead of `price`.
 * Talent-access plans carry a `talent` allowance block.
 */
export type Plan = Schemas['Plan'];

/**
 * @deprecated Use `plans.list()` and keep the rows whose `purpose` is
 * `employer_service` and whose `pricingMode` is `contact`.
 *
 * A sales-led ("contact us") plan — a custom CTA tier with no programmatic price.
 */
export type SalesLedPlan = Schemas['SalesLedPlan'];

export type PlansListQuery = {
  /** Filter to a single purpose. Omit to return all public plans. */
  purpose?:
    | 'job_posting'
    | 'talent_access'
    | 'membership'
    | 'job_seeker'
    | 'employer_service'
    | 'job_seeker_service';
};

export type PlanListEnvelope = ListEnvelope<Plan>;
export type SalesLedPlanListEnvelope = ListEnvelope<SalesLedPlan>;
