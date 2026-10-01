// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response shapes + request bodies alias the
// generated components.
import type { Schemas } from './_spec';

export type BoardUser = Schemas['BoardUser'];
export type BoardAuthSession = Schemas['BoardAuthSession'];

export type RegisterBody = Schemas['BoardAuthRegisterBody'];
export type LoginBody = Schemas['BoardAuthLoginBody'];
export type RefreshBody = Schemas['BoardAuthRefreshBody'];
export type LogoutBody = Schemas['BoardAuthLogoutBody'];
export type VerifyEmailBody = Schemas['BoardAuthVerifyEmailBody'];
export type ForgotPasswordBody = Schemas['BoardAuthForgotPasswordBody'];
export type ResetPasswordBody = Schemas['BoardAuthResetPasswordBody'];
export type RequestMagicLinkBody = Schemas['BoardAuthRequestMagicLinkBody'];
export type ConsumeMagicLinkBody = Schemas['BoardAuthConsumeMagicLinkBody'];
export type OAuthProvider = 'google' | 'linkedin';
export type OAuthAuthorizationQuery = {
  /** JSON-encoded audience evidence captured after analytics consent. */
  audienceAttribution?: string;
  returnTo?: string;
  /**
   * Role profile to create when the handshake signs up a NEW user; defaults
   * to `candidate`. Pass `employer` from an employer sign-up surface — the
   * role is fixed at authorize time and cannot be changed on the callback.
   */
  role?: 'candidate' | 'employer';
  /**
   * Complete sign-in on one of the board's development origins instead of
   * its production origin, for example `window.location.origin` while you
   * run the frontend on `http://localhost:5173`. The origin must be
   * registered for the board (Settings → SDK → Development origins, or the
   * Operator API); otherwise the call fails with
   * `board_development_origin_not_registered`. Only accepted when the client
   * identifies the board with a publishable key (`pk_...`); otherwise the
   * call fails with `board_development_origin_requires_publishable_key`.
   */
  developmentOrigin?: string;
};
export type OAuthAuthorizationUrl = Schemas['BoardAuthOAuthAuthorizationUrl'];
export type OAuthExchangeBody = Schemas['BoardAuthOAuthExchangeBody'];
