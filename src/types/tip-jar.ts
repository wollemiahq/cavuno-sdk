// Tip jar types. Response and body entities alias the generated OpenAPI
// components. The SDK stays Stripe-agnostic: a tip checkout is a
// connected-account mount kit, as for paid products.
import type { Schemas } from './_spec';

/**
 * The tip page (`tipJar.get`): name, description, currency, the smallest
 * tip, three suggested amounts, whether a note is allowed, the thank-you
 * message, and `tipCount` only while the board shows it.
 */
export type TipJar = Schemas['TipJar'];

/** Body for `tipJar.checkout`. */
export type TipJarCheckoutBody = Schemas['TipJarCheckoutBody'];

/**
 * `tipJar.checkout` result: mount the embedded Stripe Checkout with
 * `publishableKey`, `stripeAccountId` and `clientSecret`.
 */
export type TipJarCheckout = Schemas['TipJarCheckout'];

/**
 * `tipJar.getCheckout` result, after Stripe returns the tipper:
 * `processing` or `paid`, the amount, the masked receipt email and the
 * thank-you message.
 */
export type TipJarCheckoutStatus = Schemas['TipJarCheckoutStatus'];
