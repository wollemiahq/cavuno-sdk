import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  CreateJobPostingInput,
  JobPostingBillingOptions,
  JobPostingBillingVerification,
  JobPostingLogoResult,
  JobPostingPlan,
  JobPostingResult,
} from '../types/job-posting';

/**
 * `board.jobPosting.*` — the anonymous public job-submission funnel.
 *
 * `plans()` lists the board's plans; the chosen plan's `id` goes in
 * `create({ submission: { selectedPlan } })`. `create` returns a
 * status-discriminated result — branch on `.status`: `checkout` (redirect the
 * poster to `.checkoutUrl`), `published`/`pending_approval`/`invoice_sent`
 * (done). A rejected submission throws a `BoardApiError`.
 */
export function jobPostingNamespace(client: BoardClient) {
  return {
    /** List the board's job-posting plans (defaults to the `job_posting` purpose). */
    plans(
      query?: { purpose?: 'job_posting' | 'talent_access' },
      options?: FetchOptions,
    ) {
      return client.fetch<ListEnvelope<JobPostingPlan>>('/job-postings/plans', {
        ...options,
        query,
      });
    },

    /** Submit a job posting. Returns the status-discriminated outcome. */
    create(input: CreateJobPostingInput, options?: FetchOptions) {
      return client.fetch<JobPostingResult>('/job-postings', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /**
     * Upload a company logo (JPEG/PNG/WebP/GIF, ≤2 MB). Returns the stored
     * `publicUrl` — pass it back as the top-level `logoUrl` on `create(...)`.
     */
    uploadLogo(file: Blob, options?: FetchOptions) {
      const form = new FormData();
      form.append('file', file);
      return client.fetch<JobPostingLogoResult>('/job-postings/logo', {
        ...options,
        method: 'POST',
        body: form,
      });
    },

    /**
     * Look up a company logo by domain via Brandfetch, store it, and return its
     * `publicUrl` — pass it back as the top-level `logoUrl` on `create(...)`. A
     * `BoardApiError` (`job_posting_logo_not_found`) means no usable logo.
     */
    fetchLogoByDomain(domain: string, options?: FetchOptions) {
      return client.fetch<JobPostingLogoResult>('/job-postings/logo/fetch', {
        ...options,
        query: { domain },
      });
    },

    /** Email a billing-verification token (then pass it to `getBillingOptions`). */
    sendBillingVerification(input: { email: string }, options?: FetchOptions) {
      return client.fetch<JobPostingBillingVerification>(
        '/job-postings/send-verification',
        { ...options, method: 'POST', body: input },
      );
    },

    /** List the credit options for a verified email (an option → `selectedBilling`). */
    getBillingOptions(
      input: { verificationToken: string },
      options?: FetchOptions,
    ) {
      return client.fetch<JobPostingBillingOptions>(
        '/job-postings/billing-options',
        { ...options, method: 'POST', body: input },
      );
    },
  };
}
