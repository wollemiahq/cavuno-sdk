import type { BoardClient, FetchOptions } from '../client';
import type {
  JobAlertConfirmation,
  JobAlertDeletePreferenceInput,
  JobAlertManageQuery,
  JobAlertManageResult,
  JobAlertManageState,
  JobAlertManageTokenInput,
  JobAlertResendResult,
  JobAlertSubscribeInput,
  JobAlertSubscription,
  JobAlertUpdatePreferenceInput,
} from '../types/job-alerts';

/**
 * `board.jobAlerts.*` — anonymous, double-opt-in job-alert subscriptions.
 *
 * `subscribe` sends a confirmation email; the recipient completes it via
 * `confirm({ token })` (token from the email link). The digest emails carry an
 * HMAC manage token used by `manage`/`unsubscribe`/`resubscribe`/preference
 * edits. Available only when `board.context().features.jobAlerts` is true.
 */
export function jobAlertsNamespace(client: BoardClient) {
  return {
    /** Subscribe an email to job alerts. Sends a double-opt-in confirmation email. */
    subscribe(input: JobAlertSubscribeInput, options?: FetchOptions) {
      return client.fetch<JobAlertSubscription>('/job-alerts', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /** Complete double opt-in with the token from the confirmation email. */
    confirm(input: { token: string }, options?: FetchOptions) {
      return client.fetch<JobAlertConfirmation>('/job-alerts/confirm', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /** Re-send the confirmation email for an unconfirmed subscription. */
    resendConfirmation(input: { email: string }, options?: FetchOptions) {
      return client.fetch<JobAlertResendResult>(
        '/job-alerts/resend-confirmation',
        { ...options, method: 'POST', body: input },
      );
    },

    /** Read a subscription + its preferences for the manage page (HMAC token). */
    manage(query: JobAlertManageQuery, options?: FetchOptions) {
      return client.fetch<JobAlertManageState>('/job-alerts/manage', {
        ...options,
        query,
      });
    },

    /** Deactivate a subscription via the HMAC manage token. */
    unsubscribe(input: JobAlertManageTokenInput, options?: FetchOptions) {
      return client.fetch<JobAlertManageResult>('/job-alerts/unsubscribe', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /** Re-activate a previously unsubscribed subscription via the manage token. */
    resubscribe(input: JobAlertManageTokenInput, options?: FetchOptions) {
      return client.fetch<JobAlertManageResult>('/job-alerts/resubscribe', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /** Edit a preference's filters/frequency via the manage token. */
    updatePreference(
      input: JobAlertUpdatePreferenceInput,
      options?: FetchOptions,
    ) {
      return client.fetch<JobAlertManageResult>('/job-alerts/preferences', {
        ...options,
        method: 'POST',
        body: input,
      });
    },

    /** Delete a preference via the manage token. */
    deletePreference(
      input: JobAlertDeletePreferenceInput,
      options?: FetchOptions,
    ) {
      return client.fetch<JobAlertManageResult>('/job-alerts/preferences', {
        ...options,
        method: 'DELETE',
        body: input,
      });
    },
  };
}
