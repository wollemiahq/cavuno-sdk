import type { BoardClient, FetchOptions } from '../client';
import type {
  EmailPreferences,
  EmailPreferencesUpdate,
} from '../types/email-preferences';

/** The header the preferences token travels in; never put it in a URL. */
const TOKEN_HEADER = 'x-email-preferences-token';

function withToken(token: string, options?: FetchOptions): FetchOptions {
  const headers = new Headers(options?.headers as HeadersInit | undefined);
  headers.set(TOKEN_HEADER, token);
  return { ...options, headers };
}

export function emailPreferencesNamespace(client: BoardClient) {
  return {
    /**
     * The preferences behind an email's preferences link, whose `token`
     * query parameter is the person's token. Reading changes nothing. An
     * `email_preferences_token_invalid` error (403) means the link is not
     * valid for this board.
     *
     * @example
     * const token = new URL(request.url).searchParams.get('token') ?? '';
     * const prefs = await board.emailPreferences.get(token);
     * prefs.marketing.subscribed; // false
     */
    get(token: string, options?: FetchOptions) {
      return client.fetch<EmailPreferences>(
        '/email-preferences',
        withToken(token, options),
      );
    },

    /**
     * Change any preference, as the person, and get the result back.
     * Turning marketing or a topic on records `consentText` as their
     * consent, so show it next to the switch; it must name the board.
     *
     * @example
     * await board.emailPreferences.update(token, {
     *   marketing: true,
     *   consentText: 'Send me news and offers from Acme Jobs.',
     * });
     */
    update(
      token: string,
      changes: EmailPreferencesUpdate,
      options?: FetchOptions,
    ) {
      return client.fetch<EmailPreferences>('/email-preferences', {
        ...withToken(token, options),
        method: 'PATCH',
        body: changes,
      });
    },

    /**
     * Unsubscribe from all of the board's email at once: job alerts, job
     * matches, marketing and every topic. A repeat changes nothing.
     *
     * @example
     * const prefs = await board.emailPreferences.unsubscribeAll(token);
     * prefs.marketing.subscribed; // false
     */
    unsubscribeAll(token: string, options?: FetchOptions) {
      return client.fetch<EmailPreferences>(
        '/email-preferences/unsubscribe-all',
        { ...withToken(token, options), method: 'POST' },
      );
    },
  };
}
