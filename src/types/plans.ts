// Generated-spec-backed plan (employer-pricing) types. Response entities alias
// the generated OpenAPI components; the query type stays hand-written.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/**
 * A board plan (employer pricing). `purpose` is `job_posting` or
 * `talent_access`; talent-access plans carry a `talent` allowance block.
 */
export type Plan = Schemas['Plan'];

/** A sales-led ("contact us") plan — a custom CTA tier with no programmatic price. */
export type SalesLedPlan = Schemas['SalesLedPlan'];

export type PlansListQuery = {
  /** Filter to a single purpose. Omit to return all public plans. */
  purpose?: 'job_posting' | 'talent_access';
};

export type PlanListEnvelope = ListEnvelope<Plan>;
export type SalesLedPlanListEnvelope = ListEnvelope<SalesLedPlan>;
