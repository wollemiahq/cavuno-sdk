/**
 * Well-known `<domain>_<snake_reason>` codes the Board API sends, grouped by
 * surface — the catalog for i18n lookup tables and error tracking. Drift-gated
 * against the v1 API source (`error-codes.test.ts`).
 *
 * Deliberately NOT exhaustive-by-type: new codes MAY ship within v1
 * (additive, per `01-conventions.md` §11.3), so `BoardApiErrorCode` keeps
 * plain strings assignable while still autocompleting the known set.
 * `unknown_error` is SDK-synthesized when a response carries no parseable
 * envelope.
 */
export const BOARD_API_ERROR_CODES = [
  // Cross-cutting envelope
  'internal_error',
  'validation_bad_request',
  'validation_payload_too_large',
  'rate_limited',
  'rate_limit_unavailable',
  'search_unavailable',
  'too_many_filter_values',
  'pagination_invalid_cursor',
  'pagination_offset_too_large',
  'auth_unauthenticated',
  'auth_forbidden',
  'plan_upgrade_required',
  'unknown_error',
  // Board resolution + custom pages
  'boards_not_found',
  'board_page_not_found',
  // Board-user auth
  'board_auth_email_taken',
  'board_auth_invalid_credentials',
  'board_auth_invalid_token',
  'board_auth_registration_disabled',
  'board_auth_token_expired',
  'invalid_current_password',
  'no_password',
  'same_email',
  'email_taken',
  'invalid_token',
  // Board password gate
  'board_password_required',
  'board_password_invalid',
  // Jobs browse
  'jobs_not_found',
  'jobs_invalid_filter',
  // Taxonomy
  'categories_not_found',
  'skills_not_found',
  'places_not_found',
  // Companies (public reads)
  'companies_not_found',
  'company_markets_not_found',
  'company_salary_not_found',
  'company_category_salary_not_found',
  // Salaries
  'salaries_title_not_found',
  'salaries_skill_not_found',
  'salaries_location_not_found',
  'salaries_title_location_not_found',
  'salaries_skill_location_not_found',
  // Blog (public reads)
  'blog_post_not_found',
  'blog_author_not_found',
  'blog_tag_not_found',
  // Talent directory
  'talent_not_found',
  'talent_directory_not_found',
  'talent_directory_restricted',
  // Job alerts (anonymous + authenticated)
  'job_alert_not_found',
  'job_alerts_disabled',
  'candidate_alert_limit_reached',
  'candidate_alert_not_found',
  // Candidate account
  'candidate_entry_not_found',
  'candidate_handle_taken',
  'candidate_job_not_found',
  'resume_invalid_file',
  'resume_upload_forbidden',
  // Applications
  'applications_external_apply_only',
  'applications_guest_not_allowed',
  'applications_job_not_found',
  'applications_not_found',
  'applications_resume_invalid_file',
  'applications_unprocessable',
  // Messaging
  'messaging_application_not_found',
  'messaging_application_not_linked',
  'messaging_blocked',
  'messaging_cannot_block_self',
  'messaging_cold_rule',
  'messaging_conversation_not_found',
  'messaging_disabled',
  'messaging_edit_window_expired',
  'messaging_message_deleted',
  'messaging_message_not_found',
  'messaging_not_author',
  'messaging_not_participant',
  'messaging_not_permitted',
  'messaging_not_recipient',
  'messaging_rate_limited',
  'messaging_recipient_not_found',
  'messaging_recipient_not_open',
  'messaging_unsend_window_expired',
  // Employer self-service
  'employer_applicant_not_found',
  'employer_ats_unprocessable',
  'employer_checkout_failed',
  'employer_company_exists',
  'employer_company_name_taken',
  'employer_company_not_found',
  'employer_job_not_found',
  'employer_job_slug_taken',
  'employer_jobs_quota_exceeded',
  'employer_not_member',
  'employer_payment_required',
  'employer_pipeline_stage_not_found',
  'employer_member_not_found',
  'employer_invite_not_found',
  'not_company_admin',
  'not_company_member',
  'company_deletion_disabled',
  'last_admin',
  'already_member',
  'already_invited',
  'invalid_email',
  'invite_email_mismatch',
  'candidate_role',
  // Employer recommended talent — a draft job carries no vectors,
  // so it cannot be matched at all. Distinct from `jobs_not_published`.
  'job_not_published',
  // Candidate job-access paywall
  'paywall_already_active',
  'paywall_disabled',
  'paywall_invalid_checkout_session',
  'paywall_no_candidate_profile',
  'paywall_no_recurring_subscription',
  'paywall_offer_not_found',
  // Public job posting
  'job_posting_logo_lookup_unavailable',
  'job_posting_logo_not_found',
  'job_posting_rejected',
] as const;

/**
 * The known code set plus open string — new codes ship additively within v1,
 * so exhaustive narrowing is intentionally impossible.
 */
export type BoardApiErrorCode =
  | (typeof BOARD_API_ERROR_CODES)[number]
  | (string & {});

/**
 * Error raised for every non-2xx Board API response.
 *
 * Carries the complete v1 error envelope (`01-conventions.md` §5.2):
 * `{ error: { code, message, details?, requestId } }` — nothing is
 * discarded, so callers never need to string-match messages.
 *
 * @example
 * try {
 *   await board.jobs.retrieve('senior-chef');
 * } catch (e) {
 *   if (isNotFound(e)) showEmptyState();
 *   else throw e;
 * }
 */
export class BoardApiError extends Error {
  readonly status: number;
  /** `<domain>_<snake_reason>` code from the v1 error envelope. */
  readonly code: BoardApiErrorCode;
  /** Structured, per-code details — shape varies by `code`. */
  readonly details?: unknown;
  readonly requestId?: string;
  /** The parsed response body, untouched. */
  readonly raw: unknown;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    raw: unknown;
  }) {
    super(input.message);
    this.name = 'BoardApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
    this.raw = input.raw;
  }
}

/**
 * Structural, not `instanceof`: the helper subpaths (`/server`, …) and the
 * core entry build as separate bundles, so class identity differs across
 * entries — `instanceof` would silently return false for a real
 * `BoardApiError` thrown by the core client. The constructor pins
 * `name = 'BoardApiError'`, making the name check a stable brand for every
 * guard built on this one.
 */
export function isBoardApiError(e: unknown): e is BoardApiError {
  return (
    e instanceof Error &&
    e.name === 'BoardApiError' &&
    typeof (e as { status?: unknown }).status === 'number' &&
    typeof (e as { code?: unknown }).code === 'string'
  );
}

export function isNotFound(e: unknown): e is BoardApiError {
  return isBoardApiError(e) && e.status === 404;
}

export function isUnauthorized(e: unknown): e is BoardApiError {
  return isBoardApiError(e) && e.status === 401;
}

/**
 * The board is password-protected and the read carried no valid `X-Board-Access`
 * grant. Distinct from an expired board-USER token (also 401): this code means
 * "call `password.verify()` again to mint a fresh grant", not "re-login".
 */
export function isBoardPasswordRequired(e: unknown): e is BoardApiError {
  return (
    isBoardApiError(e) &&
    e.status === 401 &&
    e.code === 'board_password_required'
  );
}

export function isForbidden(e: unknown): e is BoardApiError {
  return isBoardApiError(e) && e.status === 403;
}

export function isValidationError(e: unknown): e is BoardApiError {
  return (
    isBoardApiError(e) &&
    e.status === 400 &&
    e.code === 'validation_bad_request'
  );
}

export function isRateLimited(e: unknown): e is BoardApiError {
  return isBoardApiError(e) && e.status === 429;
}

export function isConflict(e: unknown): e is BoardApiError {
  return isBoardApiError(e) && e.status === 409;
}
