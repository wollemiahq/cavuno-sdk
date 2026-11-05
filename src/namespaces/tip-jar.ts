import type { BoardClient, FetchOptions } from '../client';
import type {
  TipJar,
  TipJarCheckout,
  TipJarCheckoutBody,
  TipJarCheckoutStatus,
} from '../types/tip-jar';

export function tipJarNamespace(client: BoardClient) {
  return {
    /**
     * The board's tip page. A `tip_jar_not_found` error (404) means the
     * board has no tip jar or it is archived: hide the page and its links.
     *
     * @example
     * const jar = await board.tipJar.get();
     * jar.suggestedCents; // [300, 500, 1000]
     */
    get(options?: FetchOptions) {
      return client.fetch<TipJar>('/tip-jar', options);
    },

    /**
     * Start a tip: returns an embedded Stripe Checkout mount kit (it expires
     * after 30 minutes). Signed in, the visitor's email is filled in on
     * Stripe's form. `amountCents` is at least `minimumCents`; send a `note`
     * only when `allowNote` is true.
     *
     * @example
     * const kit = await board.tipJar.checkout({ amountCents: 500 });
     * // mount Stripe's embedded checkout with kit.clientSecret
     */
    checkout(body: TipJarCheckoutBody, options?: FetchOptions) {
      return client.fetch<TipJarCheckout>('/tip-jar/checkout', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * After Stripe returns the tipper (`session_id` on the return URL):
     * `processing` while a delayed payment clears, then `paid`, with the
     * amount, the masked receipt email and the thank-you message.
     *
     * @example
     * const s = await board.tipJar.getCheckout(sessionId);
     * if (s.status === 'paid') showThanks(s.thankYouMessage);
     */
    getCheckout(sessionId: string, options?: FetchOptions) {
      return client.fetch<TipJarCheckoutStatus>(
        `/tip-jar/checkout/${encodeURIComponent(sessionId)}`,
        options,
      );
    },
  };
}
