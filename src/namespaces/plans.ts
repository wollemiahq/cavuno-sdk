import type { BoardClient, FetchOptions } from '../client';
import type {
  PlanListEnvelope,
  PlansListQuery,
  SalesLedPlanListEnvelope,
} from '../types/plans';

export function plansNamespace(client: BoardClient) {
  return {
    /**
     * List the board's public plans as a flat list, filterable by `purpose`.
     * Group by `purpose` to render the pricing columns. Contact-led tiers are
     * plans too: they come back with `pricingMode: 'contact'`, no buyable
     * price, and the operator's `priceText` / `ctaText` / `ctaDestination`.
     *
     * @example
     * const { data } = await board.plans.list({ purpose: 'talent_access' });
     *
     * @example
     * const { data } = await board.plans.list({ purpose: 'employer_service' });
     * const contactTiers = data.filter((p) => p.pricingMode === 'contact');
     */
    list(query?: PlansListQuery, options?: FetchOptions) {
      return client.fetch<PlanListEnvelope>('/plans', { ...options, query });
    },

    /**
     * @deprecated Use `list({ purpose: 'employer_service' })` and keep the
     * rows whose `pricingMode` is `contact` — the same cards, carrying real
     * benefits and the shared plan shape. This helper stays as a
     * compatibility read of rows created before that.
     *
     * @example
     * const { data } = await board.plans.salesLed();
     */
    salesLed(options?: FetchOptions) {
      return client.fetch<SalesLedPlanListEnvelope>(
        '/sales-led-plans',
        options,
      );
    },
  };
}
