// Response shapes are generated from the v1 OpenAPI spec
// (`components.schemas`) — see scripts/gen-types.ts. The request-input
// shapes stay hand-written: the job-alert write routes carry inline
// request bodies (not registered components), so there is nothing to
// alias — these are the SDK's input contract.
import type { Schemas } from './_spec';

export type JobAlertFrequency = 'weekly';

export type JobAlertRemoteOption = 'on_site' | 'hybrid' | 'remote';

/**
 * Alert filters a consumer can capture. Only `jobFunctions` (→ job categories),
 * `placeSlugs` (→ place IDs) and `remoteOptions` scope the digest server-side;
 * `seniorityLevels`/`salary*` are stored but do not filter delivery.
 */
export type JobAlertFiltersInput = {
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

/** Query for `jobAlerts.manage` — the HMAC manage token from the digest email. */
export type JobAlertManageQuery = { subscription: string; token: string };

/** Body for `jobAlerts.unsubscribe` / `resubscribe` (HMAC manage token). */
export type JobAlertManageTokenInput = {
  subscriptionId: string;
  token: string;
  preferenceId?: string;
};

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
