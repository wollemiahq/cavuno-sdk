import { REFRESH_TOKEN_KEY, clearSession, writeSession } from '../storage';

import type { BoardClient, FetchOptions } from '../client';
import type {
  BoardAuthSession,
  ConsumeMagicLinkBody,
  ForgotPasswordBody,
  LoginBody,
  LogoutBody,
  OAuthAuthorizationQuery,
  OAuthAuthorizationUrl,
  OAuthExchangeBody,
  OAuthProvider,
  RequestMagicLinkBody,
  RefreshBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '../types/auth';

export function authNamespace(client: BoardClient) {
  async function persist(session: BoardAuthSession): Promise<BoardAuthSession> {
    await writeSession(client.storage, session);
    return session;
  }

  /**
   * `refresh`/`logout` require `{ refreshToken }` on the wire; when the
   * caller omits it we source it from storage — and fail loud when
   * neither exists (`nostore` callers must pass it explicitly).
   */
  async function resolveRefreshToken(
    body?: RefreshBody | LogoutBody,
  ): Promise<string> {
    if (body?.refreshToken) return body.refreshToken;
    const stored = await client.storage.getItem(REFRESH_TOKEN_KEY);
    if (stored === null) {
      throw new Error(
        'No refresh token available — pass { refreshToken } or configure auth.storage',
      );
    }
    return stored;
  }

  return {
    /**
     * Register a board user (emailpass). Persists the returned token
     * pair to storage and returns the session.
     *
     * @example
     * await board.auth.register({
     *   role: 'candidate',
     *   method: 'emailpass',
     *   email: 'a@b.com',
     *   password: 'hunter22',
     *   displayName: 'Ada',
     * });
     */
    async register(body: RegisterBody, options?: FetchOptions) {
      const session = await client.fetch<BoardAuthSession>('/auth/register', {
        ...options,
        method: 'POST',
        body,
      });
      return persist(session);
    },

    /**
     * Log in with email + password. Persists the returned token pair to
     * storage and returns the session. The SDK never navigates — the
     * host app owns any redirect/verification UX.
     *
     * @example
     * const { boardUser } = await board.auth.login({
     *   email: 'a@b.com',
     *   password: 'hunter22',
     * });
     */
    async login(body: LoginBody, options?: FetchOptions) {
      const session = await client.fetch<BoardAuthSession>('/auth/login', {
        ...options,
        method: 'POST',
        body,
      });
      return persist(session);
    },

    /**
     * Rotate the refresh token for a new bearer pair. Refresh tokens
     * are single-use; the rotated pair is persisted to storage. There
     * is no automatic refresh on 401 — call this explicitly.
     *
     * @example
     * await board.auth.refresh(); // uses the stored refresh token
     */
    async refresh(body?: RefreshBody, options?: FetchOptions) {
      const refreshToken = await resolveRefreshToken(body);
      const session = await client.fetch<BoardAuthSession>('/auth/refresh', {
        ...options,
        method: 'POST',
        body: { refreshToken },
      });
      return persist(session);
    },

    /**
     * Revoke the refresh token and clear stored tokens. Idempotent
     * server-side (204 even for unknown tokens). If the request itself
     * fails (network error, 5xx), stored tokens are deliberately kept —
     * clearing them would leave a live refresh token server-side while
     * the client believes it's logged out. Catch and retry, or clear
     * storage yourself to force a local logout.
     *
     * @example
     * await board.auth.logout();
     */
    async logout(body?: LogoutBody, options?: FetchOptions) {
      const refreshToken = await resolveRefreshToken(body);
      await client.fetch<void>('/auth/logout', {
        ...options,
        method: 'POST',
        body: { refreshToken },
      });
      await clearSession(client.storage);
    },

    /**
     * Confirm an email-verification token (sent by register).
     *
     * @example
     * await board.auth.verifyEmail({ token });
     */
    verifyEmail(body: VerifyEmailBody, options?: FetchOptions) {
      return client.fetch<void>('/auth/verify-email', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * Verify the signed-in board user's email with the 6-digit code from the
     * verification email (requires the bearer). Resolves void (204); an
     * invalid/expired code is a 401 `BoardApiError`. Distinct from the
     * anonymous magic-link `verifyEmail({ token })`.
     *
     * @example
     * await board.auth.verifyEmailWithCode({ code: '123456' });
     */
    verifyEmailWithCode(body: { code: string }, options?: FetchOptions) {
      return client.fetch<void>('/auth/verify-email/otp', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * Re-send the verification email (fresh code + magic link) to the signed-in
     * board user. Resolves void (204); no-op if already verified.
     *
     * @example
     * await board.auth.resendVerification();
     */
    resendVerification(options?: FetchOptions) {
      return client.fetch<void>('/auth/verify-email/resend', {
        ...options,
        method: 'POST',
      });
    },

    /**
     * Request a password-reset email. Always resolves (204) whether or
     * not the email exists — no account oracle.
     *
     * @example
     * await board.auth.forgotPassword({ email: 'a@b.com' });
     */
    forgotPassword(body: ForgotPasswordBody, options?: FetchOptions) {
      return client.fetch<void>('/auth/forgot-password', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * Set a new password with a reset token. The token is single-use;
     * all existing sessions are invalidated server-side.
     *
     * @example
     * await board.auth.resetPassword({ token, password: 'newpass99' });
     */
    resetPassword(body: ResetPasswordBody, options?: FetchOptions) {
      return client.fetch<void>('/auth/reset-password', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * Request a passwordless magic link. The API always resolves 204
     * when the request is accepted; the email link lands on the
     * board/starter `/auth/magic-link` route.
     *
     * @example
     * await board.auth.requestMagicLink({
     *   email: 'a@b.com',
     *   returnTo: '/account',
     * });
     */
    requestMagicLink(body: RequestMagicLinkBody, options?: FetchOptions) {
      return client.fetch<void>('/auth/magic-link', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * Consume a magic-link token and persist the returned bearer pair.
     *
     * @example
     * await board.auth.consumeMagicLink({ token });
     */
    async consumeMagicLink(body: ConsumeMagicLinkBody, options?: FetchOptions) {
      const session = await client.fetch<BoardAuthSession>(
        '/auth/magic-link/consume',
        {
          ...options,
          method: 'POST',
          body,
        },
      );
      return persist(session);
    },

    /**
     * Build a provider authorization URL. The SDK returns the URL; the
     * host app owns browser navigation.
     *
     * @example
     * const { authorizeUrl } = await board.auth.getOAuthAuthorizationUrl('google');
     * window.location.href = authorizeUrl;
     */
    getOAuthAuthorizationUrl(
      provider: OAuthProvider,
      query?: OAuthAuthorizationQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<OAuthAuthorizationUrl>(`/auth/oauth/${provider}`, {
        ...options,
        method: 'GET',
        query,
      });
    },

    /**
     * Exchange the provider callback one-time token and persist the
     * returned bearer pair.
     *
     * @example
     * await board.auth.exchangeOAuth({ token });
     */
    async exchangeOAuth(body: OAuthExchangeBody, options?: FetchOptions) {
      const session = await client.fetch<BoardAuthSession>(
        '/auth/oauth/exchange',
        {
          ...options,
          method: 'POST',
          body,
        },
      );
      return persist(session);
    },
  };
}
