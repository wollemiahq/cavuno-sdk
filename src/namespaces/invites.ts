import type { BoardClient, FetchOptions } from '../client';
import type {
  CompanyMemberInvitePreview,
  PreviewCompanyMemberInviteBody,
} from '../types/invites';

export function invitesNamespace(client: BoardClient) {
  return {
    /**
     * Look up a company member invite by the `token` from its link, before
     * the person signs in. Use it to render a "Join <company>" page and
     * pick the next step from `status` and `account`: sign up (`none`),
     * sign in (`employer`), or explain that the link no longer works.
     * Read-only — accept with `board.me.acceptInvite({ token })` once
     * signed in. Unknown tokens throw `employer_invite_not_found` (404).
     *
     * @example
     * const invite = await board.invites.preview({ token });
     * if (invite.status === 'pending' && invite.account === 'none') {
     *   // offer sign-up for invite.email, passing inviteToken: token
     * }
     */
    preview(body: PreviewCompanyMemberInviteBody, options?: FetchOptions) {
      return client.fetch<CompanyMemberInvitePreview>('/invites/preview', {
        ...options,
        method: 'POST',
        body,
      });
    },
  };
}
