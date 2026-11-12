// Generated from the Board API OpenAPI contract. Wire keys are preserved.
import type { Schemas } from './_spec';

/**
 * A board user's marketing-email consent, or `null` when no decision exists.
 *
 * Carries no disclosure text or wording version: the checkbox copy is authored
 * by the board's own frontend, so the API records the decision, not the prose.
 */
export type MarketingConsent = Schemas['MarketingConsent'];

/**
 * Body for `board.subscribe`: a newsletter sign-up for the board's email.
 * Nothing is granted until the person clicks the confirmation email.
 */
export type BoardSubscribeInput = Schemas['BoardSubscribeBody'];

/**
 * The uniform answer to `board.subscribe`: always `submitted`, whatever the
 * address's state. `sendingPaused` says the board's email is paused.
 */
export type SubscriptionRequest = Schemas['PublicSubscriptionRequest'];
