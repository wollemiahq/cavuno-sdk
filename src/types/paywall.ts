// Candidate-access paywall types. Response + body entities
// alias the generated OpenAPI components; the SDK stays Stripe-agnostic — the
// checkout DTO is a connected-account mount kit, not a Stripe object.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/** An enabled candidate-access paywall offer tier (public). */
export type PaywallOffer = Schemas['PaywallOffer'];

/**
 * The connected-account embedded-checkout mount kit returned by
 * `board.me.access.checkout`. Mount with `loadStripe(publishableKey, {
 * stripeAccount: stripeAccountId })` then `initEmbeddedCheckout({ clientSecret })`.
 */
export type AccessCheckoutSession = Schemas['AccessCheckoutSession'];

/** The polled state of a checkout session (`board.me.access.retrieveCheckout`). */
export type AccessCheckoutSessionState = Schemas['AccessCheckoutSessionState'];

/** The viewer's candidate-access entitlement (`board.me.access.grant`). */
export type AccessGrant = Schemas['AccessGrant'];

/** A minted Stripe billing-portal session (`board.me.access.portal`). */
export type AccessPortalSession = Schemas['AccessPortalSession'];

/** Body for `board.me.access.checkout`. */
export type AccessCheckoutBody = Schemas['AccessCheckoutBody'];

/** Body for `board.me.access.portal`. */
export type AccessPortalBody = Schemas['AccessPortalBody'];

export type PaywallOfferListEnvelope = ListEnvelope<PaywallOffer>;
