import type { BoardClient, FetchOptions } from '../client';
import type {
  ApplyApprovalPlan,
  CreateApplyApprovalBody,
} from '../types/apply-approvals';
import type {
  ApplyIntent,
  CreateApplyIntentBody,
} from '../types/apply-intents';
import type { ListEnvelope } from '../types/common';
import type {
  JobCardListEnvelope,
  JobCardSearchEnvelope,
  JobsListQuery,
  JobsSearchBody,
  JobsSimilarQuery,
  PublicJob,
  PublicJobCard,
} from '../types/jobs';
import type { Application, ApplyBody } from '../types/me';

export function jobsNamespace(client: BoardClient) {
  return {
    /**
     * List published jobs.
     *
     * @example
     * const { data, nextCursor } = await board.jobs.list({ limit: 20 });
     */
    list(query?: JobsListQuery, options?: FetchOptions) {
      return client.fetch<JobCardListEnvelope>('/jobs', {
        ...options,
        query,
      });
    },

    /**
     * Retrieve one published job by slug.
     * Compatible starters pass `x-cavuno-board-capabilities:
     * apply-gateway-v1` in `options.headers` to opt in to the country-gated
     * Apply shape. The SDK never sends that capability globally.
     *
     * @example
     * const job = await board.jobs.retrieve('senior-chef');
     */
    retrieve(
      jobSlug: string,
      query?: Record<string, never>,
      options?: FetchOptions,
    ) {
      return client.fetch<PublicJob>(`/jobs/${encodeURIComponent(jobSlug)}`, {
        ...options,
        query,
      });
    },

    /**
     * Free-text + faceted job search.
     *
     * @example
     * const { data } = await board.jobs.search({
     *   query: 'chef',
     *   filters: { seniority: ['senior'] },
     * });
     */
    search(
      body: JobsSearchBody,
      query?: Record<string, never>,
      options?: FetchOptions,
    ) {
      return client.fetch<JobCardSearchEnvelope>('/jobs/search', {
        ...options,
        method: 'POST',
        body,
        query,
      });
    },

    /**
     * List jobs similar to one job — the same ranking that powers the
     * on-page similar-jobs rail. Returns up to `limit` slim cards (default
     * 5), excluding the job itself and any role at the same company.
     *
     * @example
     * const { data } = await board.jobs.similar('senior-chef', { limit: 5 });
     */
    similar(jobSlug: string, query?: JobsSimilarQuery, options?: FetchOptions) {
      return client.fetch<ListEnvelope<PublicJobCard>>(
        `/jobs/${encodeURIComponent(jobSlug)}/similar`,
        {
          ...options,
          query,
        },
      );
    },

    /**
     * Apply to a job natively. Optional auth: a signed-in candidate
     * applies from their profile (omit name/email); a guest supplies them
     * (allowed only when the board permits applications without sign-up).
     * Idempotent — a repeat apply returns the existing application.
     *
     * @example
     * const application = await board.jobs.apply('senior-chef', {
     *   coverNote: 'Excited to cook here.',
     * });
     */
    apply(jobSlug: string, body?: ApplyBody, options?: FetchOptions) {
      return client.fetch<Application>(
        `/jobs/${encodeURIComponent(jobSlug)}/apply`,
        { ...options, method: 'POST', body: body ?? {} },
      );
    },

    /**
     * Create an opaque external-apply intent. A compatible starter sends the
     * candidate's browser to `gatewayUrl` (or asks it for the canonical JSON
     * decision after a real Apply click); never render it as a crawlable link. Pass
     * `x-cavuno-board-capabilities: apply-gateway-v1` in `options.headers`;
     * legacy callers receive 404.
     */
    createApplyIntent(
      jobSlug: string,
      body: CreateApplyIntentBody,
      options?: FetchOptions,
    ) {
      return client.fetch<ApplyIntent>(
        `/jobs/${encodeURIComponent(jobSlug)}/apply-intents`,
        { ...options, method: 'POST', body },
      );
    },

    /**
     * Prepare country approval for a signed-in candidate's native Apply.
     * When required, the candidate browser POSTs directly to `approvalUrl`
     * with no body or credentials, then supplies the returned opaque receipt
     * and the same server-owned session key to `apply`. Pass
     * `x-cavuno-board-capabilities: apply-gateway-v1` in `options.headers` for
     * both preparation and final Apply.
     *
     * @example
     * const plan = await board.jobs.prepareApplyApproval(
     *   'senior-chef',
     *   { sessionKey },
     *   { headers: {
     *     authorization: `Bearer ${accessToken}`,
     *     'x-cavuno-board-capabilities': 'apply-gateway-v1',
     *   } },
     * );
     */
    prepareApplyApproval(
      jobSlug: string,
      body: CreateApplyApprovalBody,
      options?: FetchOptions,
    ) {
      return client.fetch<ApplyApprovalPlan>(
        `/jobs/${encodeURIComponent(jobSlug)}/apply-approvals`,
        { ...options, method: 'POST', body },
      );
    },

    /**
     * Upload + attach a resume to an application (multipart). Signed-in
     * candidates target their own application for the job; a guest passes the
     * `applicationId` returned by `apply`. Returns the updated application.
     *
     * @example
     * await board.jobs.uploadApplicationResume('senior-chef', file);
     */
    uploadApplicationResume(
      jobSlug: string,
      file: Blob,
      opts?: { applicationId?: string },
      options?: FetchOptions,
    ) {
      const form = new FormData();
      form.append('file', file);
      if (opts?.applicationId) form.append('applicationId', opts.applicationId);
      return client.fetch<Application>(
        `/jobs/${encodeURIComponent(jobSlug)}/apply/resume`,
        { ...options, method: 'POST', body: form },
      );
    },

    /**
     * The authenticated candidate's application for this job (the apply-button
     * "have I applied?" check). Throws a 404 `BoardApiError` when there is none.
     *
     * @example
     * const application = await board.jobs.myApplication('senior-chef');
     */
    myApplication(jobSlug: string, options?: FetchOptions) {
      return client.fetch<Application>(
        `/jobs/${encodeURIComponent(jobSlug)}/application`,
        options,
      );
    },
  };
}
