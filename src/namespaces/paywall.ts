import type { BoardClient, FetchOptions } from '../client';
import type { PaywallOfferListEnvelope } from '../types/paywall';

export function paywallNamespace(client: BoardClient) {
  return {
    /**
     * List the board's enabled candidate-access paywall offers (public) — the
     * pricing tiers a candidate picks before starting checkout
     * (`board.me.access.checkout`). Returns `[]` when the paywall is disabled.
     * The internal Stripe price id is never exposed.
     *
     * @example
     * const { data } = await board.paywall.offers();
     */
    offers(options?: FetchOptions) {
      return client.fetch<PaywallOfferListEnvelope>(
        '/paywall/offers/enabled',
        options,
      );
    },
  };
}
