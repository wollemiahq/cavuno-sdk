// Response shapes are generated from the v1 OpenAPI spec
// (`components.schemas`) — see scripts/gen-types.ts. The request-input
// shapes stay hand-written: the job-alert write routes carry inline
// request bodies (not registered components), so there is nothing to
// alias — these are the SDK's input contract.
import type { Schemas } from './_spec';
import type { AudienceAttribution } from './audience';

export type JobAlertFrequency = 'weekly';

export type JobAlertRemoteOption = 'on_site' | 'hybrid' | 'remote';

/**
 * Alert filters a consumer can capture. Only `jobFunctions` (→ job categories),
 * `placeSlugs` (→ place IDs) and `remoteOptions` scope the digest server-side;
 * `seniorityLevels`/`salary*` are stored but do not filter delivery.
 */
export type JobAlertFiltersInput = {
  /**
   * Free-text search keywords (at most 200 characters after trimming). Send
   * the query a search page ran. On `updatePreference`, `null` clears the
   * keywords and omitting `query` keeps them while `jobFunctions` are
   * unchanged. Not accepted on a job-page (similar-job) alert.
   */
  query?: string | null;
  jobFunctions?: string[];
  seniorityLevels?: string[];
  remoteOptions?: JobAlertRemoteOption[];
  placeSlugs?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
};

/** Body for `jobAlerts.subscribe`. `consent` must be `true` (server-enforced). */
export type JobAlertSubscribeInput = {
  audienceAttribution?: AudienceAttribution;
  email: string;
  consent: true;
  frequency?: JobAlertFrequency;
  filters?: JobAlertFiltersInput;
  /** Scopes the alert to the originating job/search (for the digest + analytics). */
  context?: { source?: string; jobId?: string; jobSlug?: string };
};

export type JobAlertSubscription = Schemas['PublicJobAlertSubscription'];
export type JobAlertConfirmation = Schemas['PublicJobAlertConfirmation'];
export type JobAlertResendResult = Schemas['PublicJobAlertResend'];
export type JobAlertManageResult = Schemas['PublicJobAlertManageResult'];
export type JobAlertManageState = Schemas['PublicJobAlertManageState'];

/** One stored alert preference on the manage page. */
export type JobAlertPreference = JobAlertManageState['preferences'][number];

/** The stored filter criteria surfaced on a manage-page preference. */
export type JobAlertStoredFilters = JobAlertPreference['filters'];

/**
 * How an alert's digest is filled: `similar_job` (jobs like the job it was
 * subscribed from), `search` (a board search for its keywords) or `filters`
 * (jobs matching its stored filters exactly). Read-only.
 */
export type JobAlertKind = JobAlertPreference['kind'];

/** A similar-job alert's anchor job (`{ id, slug, title }`), or `null`. */
export type JobAlertAnchorJob = JobAlertPreference['anchorJob'];

/** Query for `jobAlerts.manage` — the HMAC manage token from the digest email. */
export type JobAlertManageQuery = { subscription: string; token: string };

/** Body for `jobAlerts.unsubscribe` / `resubscribe` (HMAC manage token). */
export type JobAlertManageTokenInput = {
  subscriptionId: string;
  token: string;
  preferenceId?: string;
};

/**
 * Body for `jobAlerts.unsubscribe`: the manage token plus, optionally, the
 * digest the link came from (its `ja_alert` / `ja_email` params, see
 * `parseJobAlertUnsubscribeParams`), so the board's job alert engagement
 * shows which email the subscriber unsubscribed from. A malformed or
 * unknown value is ignored and the unsubscribe still succeeds.
 */
export type JobAlertUnsubscribeInput = JobAlertManageTokenInput & {
  alertId?: string;
  emailId?: string;
};

/**
 * Body for `jobAlerts.recordClick`: the digest link's params (see
 * `parseJobAlertClickParams`), the job the visitor landed on, and the
 * visitor's `User-Agent` when you call from your server.
 */
export type JobAlertClickInput = {
  alertId: string;
  emailId: string;
  /** The landed job's `id`. */
  jobId: string;
  /** The job's 1-based position in the digest. */
  position: number;
  matcherVersion: string;
  /**
   * The visitor's `User-Agent` header. Pass it from a server call so
   * crawlers and link scanners are left out; without it the request's own
   * user agent is used, and a click with none is not recorded.
   */
  userAgent?: string;
};

export type JobAlertClickReceipt = Schemas['PublicJobAlertClickReceipt'];

export type JobAlertUpdatePreferenceInput = {
  subscriptionId: string;
  preferenceId: string;
  token: string;
  /** Required — the update is a full replace; restate it to avoid resetting cadence. */
  frequency: JobAlertFrequency;
  filters?: JobAlertFiltersInput;
};

export type JobAlertDeletePreferenceInput = {
  subscriptionId: string;
  preferenceId: string;
  token: string;
};
