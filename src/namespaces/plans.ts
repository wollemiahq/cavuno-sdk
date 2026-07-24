import type { BoardClient, FetchOptions } from '../client';
import type {
  PlanListEnvelope,
  PlansListQuery,
  SalesLedPlanListEnvelope,
} from '../types/plans';

export function plansNamespace(client: BoardClient) {
  return {
    /**
     * List the board's public plans (employer pricing) — job-posting +
     * talent-access plans as a flat list, filterable by `purpose`. Group by
     * `purpose` to render the pricing columns.
     *
     * @example
     * const { data } = await board.plans.list({ purpose: 'talent_access' });
     */
    list(query?: PlansListQuery, options?: FetchOptions) {
      return client.fetch<PlanListEnvelope>('/plans', { ...options, query });
    },

    /**
     * List the board's sales-led ("contact us") plans — custom marketing tiers
     * with a CTA destination and no programmatic price.
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
