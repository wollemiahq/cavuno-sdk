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
};
export type OAuthAuthorizationUrl = Schemas['BoardAuthOAuthAuthorizationUrl'];
export type OAuthExchangeBody = Schemas['BoardAuthOAuthExchangeBody'];
