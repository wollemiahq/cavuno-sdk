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
  returnTo?: string;
  /**
   * Role profile to create when the handshake signs up a NEW user; defaults
   * to `candidate`. Pass `employer` from an employer sign-up surface — the
   * role is fixed at authorize time and cannot be changed on the callback.
   */
  role?: 'candidate' | 'employer';
};
export type OAuthAuthorizationUrl = Schemas['BoardAuthOAuthAuthorizationUrl'];
export type OAuthExchangeBody = Schemas['BoardAuthOAuthExchangeBody'];
