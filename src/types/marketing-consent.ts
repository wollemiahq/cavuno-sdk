// Generated from the Board API OpenAPI contract. Wire keys are preserved.
import type { Schemas } from './_spec';

/**
 * A board user's marketing-email consent, or `null` when no decision exists.
 *
 * Carries no disclosure text or wording version: the checkbox copy is authored
 * by the board's own frontend, so the API records the decision, not the prose.
 */
export type MarketingConsent = Schemas['MarketingConsent'];
