import type { BoardClient, FetchOptions } from '../client';
import type { MarketingTopicListEnvelope } from '../types/marketing-consent';

export function marketingTopicsNamespace(client: BoardClient) {
  return {
    /**
     * The board's marketing topics, such as a weekly newsletter, oldest
     * first: render a checkbox per topic on a sign-up form and send the
     * ticked keys in `board.subscribe({ topics })`. At most 20, never
     * paginated. Empty when the board has a single marketing list.
     *
     * @example
     * const { data: topics } = await board.marketingTopics.list();
     */
    list(options?: FetchOptions) {
      return client.fetch<MarketingTopicListEnvelope>(
        '/marketing-topics',
        options,
      );
    },
  };
}
