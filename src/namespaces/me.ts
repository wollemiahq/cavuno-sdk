import type { BoardClient, FetchOptions } from '../client';
import type { BoardUser } from '../types/auth';
import type { ListEnvelope } from '../types/common';
import type { MarketingConsent } from '../types/marketing-consent';
import type {
  AddApplicantNoteBody,
  Alert,
  AlertBody,
  Application,
  ApplicationsListQuery,
  Block,
  BlockStatus,
  BlockUserBody,
  BlockedUser,
  BulkMoveApplicantsBody,
  BulkRejectApplicantsBody,
  CandidateAvatar,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateProfile,
  CandidateSkill,
  ClaimableCompany,
  CompanyMembership,
  ConfirmWorkEmailBody,
  Conversation,
  ConversationArchive,
  ConversationDetail,
  ConversationRef,
  ConversationsListQuery,
  CreateCompanyBody,
  CreateEducationBody,
  CreateEmployerJobBody,
  CreateExperienceBody,
  CreatePipelineStageBody,
  EmployerBillingOption,
  EmployerCheckout,
  EmployerCheckoutBody,
  EmployerCompany,
  EmployerCompanySearchQuery,
  EmployerJob,
  EmployerJobStat,
  EmployerJobStatsPoint,
  EmployerJobStatsTimeseriesQuery,
  EmployerProfileStats,
  EmployerProfileViewsPoint,
  EmployerProfileViewsTimeseriesQuery,
  EmployerJobSummary,
  EmployerJobsListQuery,
  EmployerPipeline,
  EmployerPipelineQuery,
  EditMessageBody,
  FindExistingConversationQuery,
  HandleAvailability,
  Message,
  ModerationReport,
  MoveApplicantStageBody,
  NotificationPreference,
  ReadReceipt,
  ReorderPipelineStagesBody,
  ReplyBody,
  ReportBody,
  Resume,
  ResumeUploadOptions,
  SaveJobBody,
  SavedJob,
  SavedJobsListQuery,
  SendWorkEmailBody,
  StartAboutApplicationBody,
  StartConversationBody,
  TalentAccess,
  ThreadMessagesQuery,
  UnreadCount,
  UnsubscribeBody,
  UpdateApplicationFactsBody,
  UpdateCandidateProfileBody,
  UpdateEducationBody,
  UpdateEmployerCompanyBody,
  UpdateEmployerJobBody,
  UpdateExperienceBody,
  UpdateLanguagesBody,
  UpdateNotificationPreferenceBody,
  UpdatePipelineStageBody,
  UpdateSkillsBody,
} from '../types/me';
import type {
  AccessCheckoutBody,
  AccessCheckoutSession,
  AccessCheckoutSessionState,
  AccessGrant,
  AccessPortalBody,
  AccessPortalSession,
} from '../types/paywall';

export function meNamespace(client: BoardClient) {
  return {
    /**
     * Retrieve the authenticated board user.
     *
     * @example
     * const me = await board.me.retrieve();
     */
    // `query?: Record<string, never>` = no query params today; the slot
    // holds the locked (id, query?, options?) shape and widens to a real
    // query type without breaking callers when the API grows one.
    retrieve(query?: Record<string, never>, options?: FetchOptions) {
      return client.fetch<BoardUser>('/me', { ...options, query });
    },

    /**
     * Permanently delete my account and all dependent data (profile,
     * collections, saved jobs, alerts, avatar/resume files). Synchronous and
     * irreversible — resolves void once the cascade completes (204).
     *
     * @example
     * await board.me.delete();
     */
    delete(options?: FetchOptions) {
      return client.fetch<void>('/me', { ...options, method: 'DELETE' });
    },

    /**
     * The authenticated candidate's own account self-service.
     * `profile.*` is the lean profile singleton + its
     * experience / education / skills / languages collections + avatar.
     */
    profile: {
      /**
       * Retrieve my lean candidate profile.
       *
       * @example
       * const profile = await board.me.profile.retrieve();
       */
      retrieve(query?: Record<string, never>, options?: FetchOptions) {
        return client.fetch<CandidateProfile>('/me/profile', {
          ...options,
          query,
        });
      },

      /**
       * Update my candidate profile. Optional-field merge-patch — omitted
       * fields stay unchanged.
       *
       * @example
       * await board.me.profile.update({ headline: 'Staff Engineer' });
       */
      update(
        body: UpdateCandidateProfileBody,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<CandidateProfile>('/me/profile', {
          ...options,
          method: 'PATCH',
          body,
          query,
        });
      },

      /**
       * Check whether a handle is available for me on this board (my own
       * current handle counts as available). Advisory — `update` re-checks.
       *
       * @example
       * const { available } = await board.me.profile.handleAvailable('jane');
       */
      handleAvailable(handle: string, options?: FetchOptions) {
        return client.fetch<HandleAvailability>(
          '/me/profile/handle-available',
          { ...options, query: { handle } },
        );
      },

      /** List my experience entries. */
      listExperience(options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateExperience>>(
          '/me/profile/experience',
          options,
        );
      },
      /** Add an experience entry. */
      createExperience(body: CreateExperienceBody, options?: FetchOptions) {
        return client.fetch<CandidateExperience>('/me/profile/experience', {
          ...options,
          method: 'POST',
          body,
        });
      },
      /** Update an experience entry (merge-patch). */
      updateExperience(
        id: string,
        body: UpdateExperienceBody,
        options?: FetchOptions,
      ) {
        return client.fetch<CandidateExperience>(
          `/me/profile/experience/${encodeURIComponent(id)}`,
          { ...options, method: 'PATCH', body },
        );
      },
      /** Delete an experience entry. */
      deleteExperience(id: string, options?: FetchOptions) {
        return client.fetch<void>(
          `/me/profile/experience/${encodeURIComponent(id)}`,
          { ...options, method: 'DELETE' },
        );
      },

      /** List my education entries. */
      listEducation(options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateEducation>>(
          '/me/profile/education',
          options,
        );
      },
      /** Add an education entry. */
      createEducation(body: CreateEducationBody, options?: FetchOptions) {
        return client.fetch<CandidateEducation>('/me/profile/education', {
          ...options,
          method: 'POST',
          body,
        });
      },
      /** Update an education entry (merge-patch). */
      updateEducation(
        id: string,
        body: UpdateEducationBody,
        options?: FetchOptions,
      ) {
        return client.fetch<CandidateEducation>(
          `/me/profile/education/${encodeURIComponent(id)}`,
          { ...options, method: 'PATCH', body },
        );
      },
      /** Delete an education entry. */
      deleteEducation(id: string, options?: FetchOptions) {
        return client.fetch<void>(
          `/me/profile/education/${encodeURIComponent(id)}`,
          { ...options, method: 'DELETE' },
        );
      },

      /** List my skills. */
      listSkills(options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateSkill>>(
          '/me/profile/skills',
          options,
        );
      },
      /** Replace my skills with the provided ordered names. */
      updateSkills(body: UpdateSkillsBody, options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateSkill>>(
          '/me/profile/skills',
          { ...options, method: 'PUT', body },
        );
      },

      /** List my languages. */
      listLanguages(options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateLanguage>>(
          '/me/profile/languages',
          options,
        );
      },
      /** Replace my languages with the provided ordered set. */
      updateLanguages(body: UpdateLanguagesBody, options?: FetchOptions) {
        return client.fetch<ListEnvelope<CandidateLanguage>>(
          '/me/profile/languages',
          { ...options, method: 'PUT', body },
        );
      },

      /**
       * Upload my avatar (JPEG/PNG/WebP, ≤5 MB) via a single multipart POST.
       *
       * @example
       * await board.me.profile.uploadAvatar(file);
       */
      uploadAvatar(file: Blob, options?: FetchOptions) {
        const form = new FormData();
        form.append('file', file);
        return client.fetch<CandidateAvatar>('/me/profile/avatar', {
          ...options,
          method: 'POST',
          body: form,
        });
      },
    },

    /**
     * Signed-in notification preferences + the anonymous email-link
     * unsubscribe branch.
     */
    notificationPreferences: {
      /** List every notification channel + its subscribed state. */
      retrieve(options?: FetchOptions) {
        return client.fetch<ListEnvelope<NotificationPreference>>(
          '/me/notification-preferences',
          options,
        );
      },
      /** Toggle one channel; returns the full updated set. */
      update(body: UpdateNotificationPreferenceBody, options?: FetchOptions) {
        return client.fetch<ListEnvelope<NotificationPreference>>(
          '/me/notification-preferences',
          { ...options, method: 'PUT', body },
        );
      },
      /**
       * Anonymous one-click unsubscribe via an HMAC email-link token — no
       * session. Resolves void on success (204).
       */
      unsubscribeWithToken(body: UnsubscribeBody, options?: FetchOptions) {
        return client.fetch<void>('/me/notification-preferences/unsubscribe', {
          ...options,
          method: 'POST',
          body,
        });
      },
    },

    /**
     * The authenticated board user's employer facet:
     * claiming/creating a company, the work-email verification state machine,
     * and editing the company profile. A board user becomes an employer by
     * claiming a company — the same identity can also be a candidate.
     */
    companies: {
      /**
       * Search companies on this board to claim.
       *
       * @example
       * const { data } = await board.me.companies.search({ q: 'acme' });
       */
      search(query: EmployerCompanySearchQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<ClaimableCompany>>(
          '/me/companies/search',
          { ...options, query },
        );
      },

      /**
       * List my company memberships, each with its computed claim `status`.
       *
       * @example
       * const { data } = await board.me.companies.list();
       */
      list(options?: FetchOptions) {
        return client.fetch<ListEnvelope<CompanyMembership>>(
          '/me/companies',
          options,
        );
      },

      /**
       * Create (or adopt an existing same-domain) company and open a
       * membership. Returns the membership.
       *
       * @example
       * await board.me.companies.create({ name: 'Acme', website: 'acme.com' });
       */
      create(body: CreateCompanyBody, options?: FetchOptions) {
        return client.fetch<CompanyMembership>('/me/companies', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Claim an existing company by slug. Returns the membership with its
       * computed status (`approved` on email-domain match, else pending).
       *
       * @example
       * await board.me.companies.claim('acme');
       */
      claim(slug: string, options?: FetchOptions) {
        return client.fetch<CompanyMembership>(
          `/me/companies/${encodeURIComponent(slug)}/claim`,
          { ...options, method: 'POST' },
        );
      },

      /**
       * Cancel my pending claim on a company. Resolves void on success (204).
       *
       * @example
       * await board.me.companies.cancelClaim('acme');
       */
      cancelClaim(slug: string, options?: FetchOptions) {
        return client.fetch<void>(
          `/me/companies/${encodeURIComponent(slug)}/claim`,
          { ...options, method: 'DELETE' },
        );
      },

      /**
       * Retrieve my full editable company profile (summary, socials, logo,
       * description) — the read half of `update`, for pre-populating an edit
       * form. Requires an approved membership.
       *
       * @example
       * const company = await board.me.companies.retrieve('acme');
       */
      retrieve(slug: string, options?: FetchOptions) {
        return client.fetch<EmployerCompany>(
          `/me/companies/${encodeURIComponent(slug)}`,
          options,
        );
      },

      /**
       * Edit my company profile (merge-patch — omitted fields stay
       * unchanged). Requires an approved membership. Returns the company.
       *
       * @example
       * await board.me.companies.update('acme', { website: 'acme.io' });
       */
      update(
        slug: string,
        body: UpdateEmployerCompanyBody,
        options?: FetchOptions,
      ) {
        return client.fetch<EmployerCompany>(
          `/me/companies/${encodeURIComponent(slug)}`,
          { ...options, method: 'PATCH', body },
        );
      },

      /**
       * Upload + attach my company logo (JPEG/PNG/WebP/GIF, ≤2 MB) via a single
       * multipart POST. Requires an approved membership. Returns the updated
       * company with its new `logoUrl`.
       *
       * @example
       * const company = await board.me.companies.uploadLogo('acme', file);
       */
      uploadLogo(slug: string, file: Blob, options?: FetchOptions) {
        const form = new FormData();
        form.append('file', file);
        return client.fetch<EmployerCompany>(
          `/me/companies/${encodeURIComponent(slug)}/logo`,
          { ...options, method: 'POST', body: form },
        );
      },

      /** The work-email verification state machine for a pending claim. */
      workEmail: {
        /**
         * Email a 24h verification link to a work email for my pending claim.
         * Returns the membership with the work email recorded.
         *
         * @example
         * await board.me.companies.workEmail.verify('acme', {
         *   workEmail: 'me@acme.com',
         * });
         */
        verify(slug: string, body: SendWorkEmailBody, options?: FetchOptions) {
          return client.fetch<CompanyMembership>(
            `/me/companies/${encodeURIComponent(slug)}/work-email/verify`,
            { ...options, method: 'POST', body },
          );
        },

        /**
         * Confirm a verification token (from the email link) — no session
         * required, the token IS the authorization. Returns the membership in
         * its new state.
         *
         * @example
         * await board.me.companies.workEmail.confirm('acme', { token });
         */
        confirm(
          slug: string,
          body: ConfirmWorkEmailBody,
          options?: FetchOptions,
        ) {
          return client.fetch<CompanyMembership>(
            `/me/companies/${encodeURIComponent(slug)}/work-email/confirm`,
            { ...options, method: 'POST', body },
          );
        },
      },

      /**
       * Manage the jobs of a company I am an approved member of . Every method is scoped to the company `slug`. New jobs are
       * created as held drafts — publishing is `publish` (within a live paid
       * window) or the paid-post checkout flow.
       */
      jobs: {
        /**
         * List a company's jobs (all statuses), newest first.
         *
         * @example
         * const { data } = await board.me.companies.jobs.list('acme');
         */
        list(
          slug: string,
          query?: EmployerJobsListQuery,
          options?: FetchOptions,
        ) {
          return client.fetch<ListEnvelope<EmployerJobSummary>>(
            `/me/companies/${encodeURIComponent(slug)}/jobs`,
            { ...options, query },
          );
        },

        /**
         * Retrieve one of my company's jobs (any status), fully enriched.
         *
         * @example
         * const job = await board.me.companies.jobs.retrieve('acme', jobId);
         */
        retrieve(slug: string, id: string, options?: FetchOptions) {
          return client.fetch<EmployerJob>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`,
            options,
          );
        },

        /**
         * Create a job as a held draft. Returns the created job.
         *
         * @example
         * await board.me.companies.jobs.create('acme', {
         *   title: 'Staff Engineer',
         *   description: '…',
         *   applicationUrl: 'https://acme.com/apply',
         * });
         */
        create(
          slug: string,
          body: CreateEmployerJobBody,
          options?: FetchOptions,
        ) {
          return client.fetch<EmployerJob>(
            `/me/companies/${encodeURIComponent(slug)}/jobs`,
            { ...options, method: 'POST', body },
          );
        },

        /**
         * Edit a job (merge-patch — omitted fields stay unchanged). Returns the
         * updated job.
         *
         * @example
         * await board.me.companies.jobs.update('acme', jobId, {
         *   salaryMax: 220000,
         * });
         */
        update(
          slug: string,
          id: string,
          body: UpdateEmployerJobBody,
          options?: FetchOptions,
        ) {
          return client.fetch<EmployerJob>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`,
            { ...options, method: 'PATCH', body },
          );
        },

        /**
         * Delete a job (cascade). Resolves void on success (204).
         *
         * @example
         * await board.me.companies.jobs.delete('acme', jobId);
         */
        delete(slug: string, id: string, options?: FetchOptions) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`,
            { ...options, method: 'DELETE' },
          );
        },

        /**
         * Publish a job that is still inside its paid window (republish — a held
         * draft or expired job must instead pay via checkout). Returns the
         * updated job.
         *
         * @example
         * await board.me.companies.jobs.publish('acme', jobId);
         */
        publish(slug: string, id: string, options?: FetchOptions) {
          return client.fetch<EmployerJob>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}/publish`,
            { ...options, method: 'POST' },
          );
        },

        /**
         * Unpublish a job (back to draft; the paid window is preserved). Returns
         * the updated job.
         *
         * @example
         * await board.me.companies.jobs.unpublish('acme', jobId);
         */
        unpublish(slug: string, id: string, options?: FetchOptions) {
          return client.fetch<EmployerJob>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}/unpublish`,
            { ...options, method: 'POST' },
          );
        },

        /**
         * Pay for / publish a held draft. Select billing: a paid plan
         * returns `{ status: 'checkout', checkoutUrl }` (send the buyer there;
         * the webhook publishes on payment); a free / bundle / subscription plan
         * publishes immediately (`status: 'published'`); an invoice plan emails a
         * Stripe invoice (`status: 'invoice_sent'`).
         *
         * @example
         * const r = await board.me.companies.jobs.checkout('acme', jobId, {
         *   billing: { type: 'new', planId },
         * });
         * if (r.status === 'checkout') location.href = r.checkoutUrl!;
         */
        checkout(
          slug: string,
          id: string,
          body: EmployerCheckoutBody,
          options?: FetchOptions,
        ) {
          return client.fetch<EmployerCheckout>(
            `/me/companies/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}/checkout`,
            { ...options, method: 'POST', body },
          );
        },
      },

      /**
       * My reusable billing options for a company — active subscription slots +
       * remaining pre-purchased (bundle) order slots, the options a held draft
       * can be published with at no new charge (the checkout `billing.type:
       * 'order' | 'subscription'`).
       */
      billingOptions: {
        /**
         * List my reusable billing options for the company.
         *
         * @example
         * const { data } = await board.me.companies.billingOptions.list('acme');
         */
        list(slug: string, options?: FetchOptions) {
          return client.fetch<ListEnvelope<EmployerBillingOption>>(
            `/me/companies/${encodeURIComponent(slug)}/billing-options`,
            options,
          );
        },
      },

      /**
       * The read-only reporting funnel that backs the hosted employer jobs
       * table: per-job views / apply clicks / native applications,
       * plus a daily views+apply-clicks time-series for a chart. Membership-
       * scoped; never cached. Analytics degrade to zeroes when reporting data
       * is temporarily unavailable, so a `0` means
       * "no activity" OR "analytics briefly unavailable".
       */
      jobStats: {
        /**
         * Per-job stats across ALL of a company's jobs, one row per job.
         *
         * @example
         * const { data } = await board.me.companies.jobStats.retrieve('acme');
         * for (const s of data) {
         *   console.log(s.jobId, s.views, s.applyClicks, s.applications);
         * }
         */
        retrieve(slug: string, options?: FetchOptions) {
          return client.fetch<ListEnvelope<EmployerJobStat>>(
            `/me/companies/${encodeURIComponent(slug)}/job-stats`,
            options,
          );
        },

        /**
         * Daily buckets of views + apply clicks aggregated across the
         * company's jobs, to power a chart. Zero-filled over `[since, until]`
         * (default: last 30 days), ascending by date.
         *
         * @example
         * const { data } = await board.me.companies.jobStats.timeseries('acme', {
         *   since: '2026-06-01T00:00:00Z',
         * });
         */
        timeseries(
          slug: string,
          query?: EmployerJobStatsTimeseriesQuery,
          options?: FetchOptions,
        ) {
          return client.fetch<ListEnvelope<EmployerJobStatsPoint>>(
            `/me/companies/${encodeURIComponent(slug)}/job-stats/timeseries`,
            { ...options, query },
          );
        },
      },

      /**
       * Company-profile page views for the employer dashboard's
       * "profile views" metric — visits to the company profile page ITSELF
       * (`/companies/{slug}`, tab subpaths and bots excluded), NOT job details.
       * Membership-scoped; never cached; degrades to `0` / an empty series on
       * an analytics outage.
       */
      profileStats: {
        /**
         * Total company-profile-page views over the all-time window.
         *
         * @example
         * const { profileViews } =
         *   await board.me.companies.profileStats.retrieve('acme');
         */
        retrieve(slug: string, options?: FetchOptions) {
          return client.fetch<EmployerProfileStats>(
            `/me/companies/${encodeURIComponent(slug)}/profile-stats`,
            options,
          );
        },

        /**
         * Daily company-profile-page views, to power a sparkline. Zero-filled
         * over `[since, until]` (default: last 30 days), ascending by date.
         *
         * @example
         * const { data } = await board.me.companies.profileStats.timeseries(
         *   'acme',
         *   { since: '2026-06-01T00:00:00Z' },
         * );
         */
        timeseries(
          slug: string,
          query?: EmployerProfileViewsTimeseriesQuery,
          options?: FetchOptions,
        ) {
          return client.fetch<ListEnvelope<EmployerProfileViewsPoint>>(
            `/me/companies/${encodeURIComponent(slug)}/profile-stats/timeseries`,
            { ...options, query },
          );
        },
      },

      /**
       * The applicant pipeline (ATS) for a company I am an approved member of
       * Reads return the full pipeline (job
       * header + stage rail + applicants with timelines); the move/reject/note
       * writes resolve void — re-read the pipeline for fresh state, mirroring
       * the hosted portal's single reactive query.
       */
      applicants: {
        /**
         * Read a job's applicant pipeline: its header, stage rail, and every
         * applicant (candidate snapshot, signed resume URL, activity timeline).
         * `query.job` is required; `query.stage` filters to one stage.
         *
         * @example
         * const pipeline = await board.me.companies.applicants.list('acme', {
         *   job: jobId,
         * });
         */
        list(
          slug: string,
          query: EmployerPipelineQuery,
          options?: FetchOptions,
        ) {
          return client.fetch<EmployerPipeline>(
            `/me/companies/${encodeURIComponent(slug)}/applicants`,
            { ...options, query },
          );
        },

        /**
         * Move one applicant to a visible stage of its job's pipeline. Resolves
         * void on success (204).
         *
         * @example
         * await board.me.companies.applicants.move('acme', applicationId, {
         *   stageId,
         * });
         */
        move(
          slug: string,
          applicationId: string,
          body: MoveApplicantStageBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/applicants/${encodeURIComponent(applicationId)}/stage`,
            { ...options, method: 'PATCH', body },
          );
        },

        /**
         * Move many applicants of one job to a visible stage atomically.
         * Resolves void on success (204).
         *
         * @example
         * await board.me.companies.applicants.bulkMove('acme', {
         *   applicationIds, stageId,
         * });
         */
        bulkMove(
          slug: string,
          body: BulkMoveApplicantsBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/applicants/bulk/move`,
            { ...options, method: 'POST', body },
          );
        },

        /**
         * Reject many applicants of one job atomically (move to the rejected
         * stage). Resolves void on success (204).
         *
         * @example
         * await board.me.companies.applicants.bulkReject('acme', {
         *   applicationIds,
         * });
         */
        bulkReject(
          slug: string,
          body: BulkRejectApplicantsBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/applicants/bulk/reject`,
            { ...options, method: 'POST', body },
          );
        },

        /**
         * Append a company-private note to an applicant (it surfaces in the
         * applicant timeline). Resolves void on success (204).
         *
         * @example
         * await board.me.companies.applicants.addNote('acme', applicationId, {
         *   body: 'Strong candidate.',
         * });
         */
        addNote(
          slug: string,
          applicationId: string,
          body: AddApplicantNoteBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/applicants/${encodeURIComponent(applicationId)}/notes`,
            { ...options, method: 'POST', body },
          );
        },
      },

      /**
       * The pipeline stage rail (ATS) for a company I am an approved member of.
       * Every write resolves void (the backing portal mutations return void) —
       * re-read the pipeline via `applicants.list` for the fresh stage rail.
       */
      pipelineStages: {
        /**
         * Add a custom stage to a job pipeline (before the terminal
         * Hired/Rejected stages; up to 10 custom per job). Resolves void (204).
         *
         * @example
         * await board.me.companies.pipelineStages.create('acme', {
         *   jobId, label: 'Phone screen',
         * });
         */
        create(
          slug: string,
          body: CreatePipelineStageBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/pipeline-stages`,
            { ...options, method: 'POST', body },
          );
        },

        /**
         * Rename a stage (`{ label }`) or show/hide it (`{ hidden }`) — exactly
         * one. Resolves void on success (204).
         *
         * @example
         * await board.me.companies.pipelineStages.update('acme', stageId, {
         *   label: 'Tech screen',
         * });
         */
        update(
          slug: string,
          stageId: string,
          body: UpdatePipelineStageBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/pipeline-stages/${encodeURIComponent(stageId)}`,
            { ...options, method: 'PATCH', body },
          );
        },

        /**
         * Remove a custom stage (protected stages cannot be removed). Resolves
         * void on success (204).
         *
         * @example
         * await board.me.companies.pipelineStages.remove('acme', stageId);
         */
        remove(slug: string, stageId: string, options?: FetchOptions) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/pipeline-stages/${encodeURIComponent(stageId)}`,
            { ...options, method: 'DELETE' },
          );
        },

        /**
         * Set the full stage order for a job (list every stage exactly once,
         * keeping Review first and Hired immediately before Rejected). Resolves
         * void on success (204).
         *
         * @example
         * await board.me.companies.pipelineStages.reorder('acme', {
         *   jobId, orderedStageIds,
         * });
         */
        reorder(
          slug: string,
          body: ReorderPipelineStagesBody,
          options?: FetchOptions,
        ) {
          return client.fetch<void>(
            `/me/companies/${encodeURIComponent(slug)}/pipeline-stages/reorder`,
            { ...options, method: 'PUT', body },
          );
        },
      },
    },

    /**
     * The viewer's talent entitlement on this board — "does this
     * employer have talent access?" for gating a Message-vs-upsell CTA.
     * Candidates and unaffiliated viewers get `hasTalentAccess: false`.
     *
     * @example
     * const { hasTalentAccess } = await board.me.talentAccess.retrieve();
     */
    talentAccess: {
      /**
       * Retrieve the viewer's talent entitlement. Never cache — per-user.
       *
       * @example
       * const access = await board.me.talentAccess.retrieve();
       */
      retrieve(options?: FetchOptions) {
        return client.fetch<TalentAccess>('/me/talent-access', options);
      },
    },

    /**
     * The authenticated board user's job-alert preferences —
     * a collection (up to 10). Creating one is active immediately (no
     * double opt-in — the authenticated action is the consent). There is no
     * pause: `remove` is the only way to stop an alert.
     */
    alerts: {
      /**
       * List my job alerts.
       *
       * @example
       * const { data } = await board.me.alerts.list();
       */
      list(options?: FetchOptions) {
        return client.fetch<ListEnvelope<Alert>>('/me/alerts', options);
      },

      /**
       * Create a new active job alert.
       *
       * @example
       * await board.me.alerts.create({
       *   frequency: 'weekly',
       *   jobFunctions: ['engineering'],
       *   remoteOptions: ['remote'],
       * });
       */
      create(body: AlertBody, options?: FetchOptions) {
        return client.fetch<Alert>('/me/alerts', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Retrieve one of my job alerts.
       *
       * @example
       * const alert = await board.me.alerts.retrieve(alertId);
       */
      retrieve(alertId: string, options?: FetchOptions) {
        return client.fetch<Alert>(
          `/me/alerts/${encodeURIComponent(alertId)}`,
          options,
        );
      },

      /**
       * Replace a job alert's filters + frequency in full. Returns the updated
       * alert.
       *
       * @example
       * await board.me.alerts.update(alertId, {
       *   frequency: 'weekly',
       *   placeIds: ['ChIJ…'],
       * });
       */
      update(alertId: string, body: AlertBody, options?: FetchOptions) {
        return client.fetch<Alert>(
          `/me/alerts/${encodeURIComponent(alertId)}`,
          { ...options, method: 'PUT', body },
        );
      },

      /**
       * Delete a job alert. Resolves void on success (204).
       *
       * @example
       * await board.me.alerts.remove(alertId);
       */
      remove(alertId: string, options?: FetchOptions) {
        return client.fetch<void>(`/me/alerts/${encodeURIComponent(alertId)}`, {
          ...options,
          method: 'DELETE',
        });
      },
    },

    /**
     * The authenticated candidate's applications. Apply itself lives
     * on the job (`board.jobs.apply` — it is optional-auth); these manage the
     * applications the candidate has already submitted, keyed by `applicationId`.
     */
    applications: {
      /**
       * List my applications, newest first.
       *
       * @example
       * const { data } = await board.me.applications.list();
       */
      list(query?: ApplicationsListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<Application>>('/me/applications', {
          ...options,
          query,
        });
      },

      /**
       * Retrieve one of my applications by id.
       *
       * @example
       * const application = await board.me.applications.retrieve(id);
       */
      retrieve(applicationId: string, options?: FetchOptions) {
        return client.fetch<Application>(
          `/me/applications/${encodeURIComponent(applicationId)}`,
          options,
        );
      },

      /**
       * Edit the candidate-facing facts of an application (merge-patch). Only
       * while it is still editable. Returns the updated application.
       *
       * @example
       * await board.me.applications.updateFacts(id, { coverNote: '…' });
       */
      updateFacts(
        applicationId: string,
        body: UpdateApplicationFactsBody,
        options?: FetchOptions,
      ) {
        return client.fetch<Application>(
          `/me/applications/${encodeURIComponent(applicationId)}`,
          { ...options, method: 'PATCH', body },
        );
      },

      /**
       * Withdraw (permanently delete) an application. Resolves void on 204.
       *
       * @example
       * await board.me.applications.withdraw(id);
       */
      withdraw(applicationId: string, options?: FetchOptions) {
        return client.fetch<void>(
          `/me/applications/${encodeURIComponent(applicationId)}/withdraw`,
          { ...options, method: 'POST' },
        );
      },
    },

    /**
     * The candidate's resume. `upload` starts an async parse that
     * auto-populates the profile — it returns `parseStatus: 'parsing'`; poll
     * `retrieve()` until `parsed`/`failed`, then re-read `profile.*`.
     */
    resume: {
      /**
       * Upload a resume and start the async parse. Returns the resume with
       * `parseStatus: 'parsing'`.
       *
       * @example
       * await board.me.resume.upload(file, { keepResumeOnFile: true });
       */
      upload(file: Blob, opts?: ResumeUploadOptions, options?: FetchOptions) {
        const form = new FormData();
        form.append('resume', file);
        if (opts?.keepResumeOnFile) form.append('keepResumeOnFile', 'true');
        if (opts?.importMode) form.append('importMode', opts.importMode);
        if (opts?.confirmReplaceAll) form.append('confirmReplaceAll', 'true');
        return client.fetch<Resume>('/me/resume', {
          ...options,
          method: 'POST',
          body: form,
        });
      },

      /**
       * Retrieve my resume state (parse status + stored file). Poll this after
       * `upload` until `parseStatus` is `parsed` or `failed`.
       *
       * @example
       * const resume = await board.me.resume.retrieve();
       */
      retrieve(options?: FetchOptions) {
        return client.fetch<Resume>('/me/resume', options);
      },

      /**
       * Delete my stored resume file + withdraw keep-on-file consent (parsed
       * profile fields stay). Resolves void (204).
       *
       * @example
       * await board.me.resume.delete();
       */
      delete(options?: FetchOptions) {
        return client.fetch<void>('/me/resume', {
          ...options,
          method: 'DELETE',
        });
      },
    },

    savedJobs: {
      /**
       * List the authenticated user's saved jobs (each embeds the full
       * `public_job`).
       *
       * @example
       * const { data } = await board.me.savedJobs.list({ limit: 20 });
       */
      list(query?: SavedJobsListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<SavedJob>>('/me/saved-jobs', {
          ...options,
          query,
        });
      },

      /**
       * Save a job. Converges — saving an already-saved job returns the
       * identical row.
       *
       * @example
       * await board.me.savedJobs.save({ jobId: job.id });
       */
      save(
        body: SaveJobBody,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<SavedJob>('/me/saved-jobs', {
          ...options,
          method: 'POST',
          body,
          query,
        });
      },

      /**
       * Unsave a job. Idempotent — unknown IDs still 204.
       *
       * @example
       * await board.me.savedJobs.unsave(job.id);
       */
      unsave(
        jobId: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<void>(
          `/me/saved-jobs/${encodeURIComponent(jobId)}`,
          { ...options, method: 'DELETE', query },
        );
      },
    },

    /**
     * The authenticated board user's messaging inbox.
     * The v1 surface is polled REST — there is no realtime primitive; poll
     * `list` / `listMessages` / `unreadCount` on an interval (3–5s is the
     * reference cadence) for near-live updates.
     */
    conversations: {
      /**
       * List my conversations (each page sorted most-recent-activity-first;
       * cross-page cursor order is approximate — see the API docs). `archived:
       * true` returns the archived view. Poll for inbox liveness.
       *
       * @example
       * const { data } = await board.me.conversations.list({ limit: 20 });
       */
      list(query?: ConversationsListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<Conversation>>('/me/conversations', {
          ...options,
          query,
        });
      },

      /**
       * The count of distinct conversations with an unread message — the
       * inbox badge. Poll for liveness.
       *
       * @example
       * const { count } = await board.me.conversations.unreadCount();
       */
      unreadCount(options?: FetchOptions) {
        return client.fetch<UnreadCount>(
          '/me/conversations/unread-count',
          options,
        );
      },

      /**
       * A conversation's header — live-resolved counterparty identity, the
       * viewer's role, and the viewer's last-read pointer. The messages are a
       * separate paginated call (`listMessages`).
       *
       * @example
       * const convo = await board.me.conversations.retrieve(id);
       */
      retrieve(id: string, options?: FetchOptions) {
        return client.fetch<ConversationDetail>(
          `/me/conversations/${encodeURIComponent(id)}`,
          options,
        );
      },

      /**
       * A conversation's messages, oldest-first (append order). Unsent
       * messages are tombstones (empty `body`, `deletedAt` set). Poll for the
       * live thread.
       *
       * @example
       * const { data } = await board.me.conversations.listMessages(id, { limit: 50 });
       */
      listMessages(
        id: string,
        query?: ThreadMessagesQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<ListEnvelope<Message>>(
          `/me/conversations/${encodeURIComponent(id)}/messages`,
          { ...options, query },
        );
      },

      /**
       * Cold-initiate a conversation with a candidate (employer-only).
       * Converges on the existing thread. Returns the created message.
       *
       * @example
       * const msg = await board.me.conversations.start({ candidateBoardUserId, body: 'Hi!' });
       */
      start(body: StartConversationBody, options?: FetchOptions) {
        return client.fetch<Message>('/me/conversations', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Message an applicant from the ATS (application context, outside the
       * talent paywall). Returns the created message.
       *
       * @example
       * const msg = await board.me.conversations.startAboutApplication({ applicationId, body: '…' });
       */
      startAboutApplication(
        body: StartAboutApplicationBody,
        options?: FetchOptions,
      ) {
        return client.fetch<Message>('/me/conversations/about-application', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Reply in an existing conversation. Returns the created message.
       *
       * @example
       * const msg = await board.me.conversations.reply(id, { body: 'Sounds good' });
       */
      reply(id: string, body: ReplyBody, options?: FetchOptions) {
        return client.fetch<Message>(
          `/me/conversations/${encodeURIComponent(id)}/reply`,
          { ...options, method: 'POST', body },
        );
      },

      /**
       * Mark a conversation read for the viewer. Idempotent.
       *
       * @example
       * await board.me.conversations.markRead(id);
       */
      markRead(id: string, options?: FetchOptions) {
        return client.fetch<ReadReceipt>(
          `/me/conversations/${encodeURIComponent(id)}/read`,
          { ...options, method: 'POST' },
        );
      },

      /**
       * Archive a conversation for the viewer (per-side). Idempotent.
       *
       * @example
       * await board.me.conversations.archive(id);
       */
      archive(id: string, options?: FetchOptions) {
        return client.fetch<ConversationArchive>(
          `/me/conversations/${encodeURIComponent(id)}/archive`,
          { ...options, method: 'POST' },
        );
      },

      /**
       * Move an archived conversation back to the main inbox. Idempotent.
       *
       * @example
       * await board.me.conversations.unarchive(id);
       */
      unarchive(id: string, options?: FetchOptions) {
        return client.fetch<ConversationArchive>(
          `/me/conversations/${encodeURIComponent(id)}/unarchive`,
          { ...options, method: 'POST' },
        );
      },

      /**
       * The existing employer↔candidate conversation id (or null).
       * talent-contact helper — route to an existing thread instead of opening
       * a composer.
       *
       * @example
       * const { conversationId } = await board.me.conversations.findExisting({ candidateBoardUserId });
       */
      findExisting(
        query: FindExistingConversationQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<ConversationRef>(
          '/me/conversations/find-existing',
          { ...options, query },
        );
      },
    },

    /**
     * Blocking: list / add / remove blocks + a  status check.
     */
    blocks: {
      /**
       * The users I've blocked.
       *
       * @example
       * const { data } = await board.me.blocks.list();
       */
      list(options?: FetchOptions) {
        return client.fetch<ListEnvelope<BlockedUser>>('/me/blocks', options);
      },

      /**
       * Block a user (silent). Idempotent.
       *
       * @example
       * await board.me.blocks.create({ boardUserId });
       */
      create(body: BlockUserBody, options?: FetchOptions) {
        return client.fetch<Block>('/me/blocks', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Unblock a user. Idempotent.
       *
       * @example
       * await board.me.blocks.remove(boardUserId);
       */
      remove(boardUserId: string, options?: FetchOptions) {
        return client.fetch<void>(
          `/me/blocks/${encodeURIComponent(boardUserId)}`,
          { ...options, method: 'DELETE' },
        );
      },

      /**
       * Whether I've blocked a user.
       *
       * @example
       * const { blocked } = await board.me.blocks.status(boardUserId);
       */
      status(boardUserId: string, options?: FetchOptions) {
        return client.fetch<BlockStatus>(
          `/me/blocks/${encodeURIComponent(boardUserId)}`,
          options,
        );
      },
    },

    /**
     * Message-scoped actions: edit / unsend your own messages
     * (15-minute window), and report a message addressed to you.
     */
    messages: {
      /**
       * Edit one of your own messages (within the 15-minute window). Returns
       * the updated message.
       *
       * @example
       * const msg = await board.me.messages.edit(id, { body: 'fixed typo' });
       */
      edit(id: string, body: EditMessageBody, options?: FetchOptions) {
        return client.fetch<Message>(`/me/messages/${encodeURIComponent(id)}`, {
          ...options,
          method: 'PATCH',
          body,
        });
      },

      /**
       * Unsend (soft-delete) one of your own messages (within the 15-minute
       * window). Idempotent. Returns the tombstoned message (empty `body`).
       *
       * @example
       * await board.me.messages.unsend(id);
       */
      unsend(id: string, options?: FetchOptions) {
        return client.fetch<Message>(`/me/messages/${encodeURIComponent(id)}`, {
          ...options,
          method: 'DELETE',
        });
      },

      /**
       * Report a message addressed to you for moderation. Auto-blocks the
       * author.
       *
       * @example
       * const { blocked } = await board.me.messages.report(id, { reason: 'spam' });
       */
      report(id: string, body: ReportBody, options?: FetchOptions) {
        return client.fetch<ModerationReport>(
          `/me/messages/${encodeURIComponent(id)}/report`,
          { ...options, method: 'POST', body },
        );
      },
    },

    /**
     * My marketing-email consent.
     *
     * Consent is a property of the board user, given at sign-up or from the
     * board's own settings page. Both surfaces render board-authored
     * disclosure wording — the API records the decision, never the prose, so
     * whatever you show beside these calls is what the person agreed to.
     */
    marketingConsent: {
      /** My consent, or `null` when no decision has ever been recorded. */
      retrieve(options?: FetchOptions) {
        return client.fetch<MarketingConsent | null>(
          '/me/marketing-consent',
          options,
        );
      },

      /**
       * Grant. Call this only from a surface that displayed your disclosure
       * copy — nothing server-side can check that you did.
       */
      grant(options?: FetchOptions) {
        return client.fetch<MarketingConsent>('/me/marketing-consent/grant', {
          ...options,
          method: 'POST',
        });
      },

      /** Withdraw. Repeating it returns the same state, no new event. */
      withdraw(options?: FetchOptions) {
        return client.fetch<MarketingConsent | null>(
          '/me/marketing-consent/withdraw',
          { ...options, method: 'POST' },
        );
      },
    },

    /**
     * The candidate job-access paywall — the authenticated money flow . Enumerate offers publicly with `board.paywall.offers()`, then
     * `checkout` here; poll `retrieveCheckout` until complete and confirm with
     * `grant`. The SDK stays Stripe-agnostic — `checkout` returns a mount kit
     * and the frontend brings `@stripe/stripe-js`.
     */
    access: {
      /**
       * Start an embedded checkout for one offer and return a connected-account
       * mount kit `{ sessionId, clientSecret, stripeAccountId, publishableKey,
       * offerType }`. `returnPath` is a safe relative path. Requires a candidate
       * profile.
       *
       * @example
       * const kit = await board.me.access.checkout({
       *   offerKey: 'monthly',
       *   returnPath: '/account/access',
       *   colorMode: 'light',
       * });
       * const stripe = await loadStripe(kit.publishableKey, {
       *   stripeAccount: kit.stripeAccountId,
       * });
       */
      checkout(body: AccessCheckoutBody, options?: FetchOptions) {
        return client.fetch<AccessCheckoutSession>('/me/access/checkout', {
          ...options,
          method: 'POST',
          body,
        });
      },

      /**
       * Poll a checkout session's state: `open` (re-mountable via
       * `clientSecret`), `complete`, or `expired`. On `complete`, re-read
       * `grant()` to confirm entitlement.
       *
       * @example
       * const s = await board.me.access.retrieveCheckout(kit.sessionId);
       */
      retrieveCheckout(sessionId: string, options?: FetchOptions) {
        return client.fetch<AccessCheckoutSessionState>(
          `/me/access/checkout/${encodeURIComponent(sessionId)}`,
          options,
        );
      },

      /**
       * The viewer's candidate-access entitlement — always resolves (no-access
       * is `{ hasAccess: false, … }`, not an error). Gate the ungated jobs
       * listing on `hasAccess`.
       *
       * @example
       * const { hasAccess } = await board.me.access.grant();
       */
      grant(options?: FetchOptions) {
        return client.fetch<AccessGrant>('/me/access/grant', options);
      },

      /**
       * Open a Stripe billing-portal session to manage a recurring subscription
       * (only when the grant's `offerType` is `recurring`). Optional
       * `returnPath` threads through to Stripe's return URL.
       *
       * @example
       * const { url } = await board.me.access.portal({ returnPath: '/account' });
       * location.href = url;
       */
      portal(body?: AccessPortalBody, options?: FetchOptions) {
        return client.fetch<AccessPortalSession>('/me/access/portal', {
          ...options,
          method: 'POST',
          body,
        });
      },
    },
  };
}
