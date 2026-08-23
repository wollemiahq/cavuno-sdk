import type { Schemas } from './_spec';

/** Server-side request that prepares a browser-direct country approval. */
export type CreateApplyApprovalBody = Schemas['CreateApplyApprovalBody'];

/** Generic plan; `not_required` deliberately does not disclose why. */
export type ApplyApprovalPlan = Schemas['ApplyApprovalPlan'];

/** Cookieless `/r/:opaque` response returned only to the bound board origin. */
export interface ApplyApprovalReceipt {
  object: 'apply_approval_receipt';
  id: string;
  expiresAt: string;
}
