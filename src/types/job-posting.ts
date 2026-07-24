// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. The write input + the discriminated result alias the
// generated components; no serializer to drift from.
import type { Schemas } from './_spec';

/** A board plan for the job-submission wizard. The `id` is the `selectedPlan`. */
export type JobPostingPlan = Schemas['JobPostingPlan'];

/** The body of `board.jobPosting.create(...)`. */
export type CreateJobPostingInput = Schemas['CreateJobPostingBody'];

/**
 * The status-discriminated outcome of a submission: `checkout` (a Stripe
 * Checkout URL to redirect to), `published`, `pending_approval`, or
 * `invoice_sent`. A rejected submission throws a `BoardApiError` instead.
 */
export type JobPostingResult = Schemas['JobPostingResult'];

/**
 * The result of `uploadLogo()` / `fetchLogoByDomain()`: a stored logo whose
 * `publicUrl` you pass back as the top-level `logoUrl` on `create(...)`.
 */
export type JobPostingLogoResult = Schemas['JobPostingLogo'];

// ── Billing-helper results (the wizard's billing step) ──────────────────────

export type JobPostingBillingVerification =
  Schemas['JobPostingBillingVerification'];
export type JobPostingBillingOptions = Schemas['JobPostingBillingOptions'];
