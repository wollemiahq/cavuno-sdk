// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts.
import type { Schemas } from './_spec';

/**
 * A company member invite looked up by token before sign-in
 * (`board.invites.preview()`). `email` and `account` are only set while
 * `status` is `pending`.
 */
export type CompanyMemberInvitePreview = Schemas['CompanyMemberInvitePreview'];
/** Body for `board.invites.preview`. */
export type PreviewCompanyMemberInviteBody =
  Schemas['PreviewCompanyMemberInviteBody'];
