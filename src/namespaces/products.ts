import type { BoardClient, FetchOptions } from '../client';
import type {
  Product,
  ProductCardListEnvelope,
  ProductCheckout,
  ProductCheckoutBody,
  ProductCheckoutStatus,
  ProductReviewListEnvelope,
  ProductReviewsQuery,
  ProductsListQuery,
} from '../types/products';

const productBase = (slug: string) => `/products/${encodeURIComponent(slug)}`;

export function productsNamespace(client: BoardClient) {
  return {
    /**
     * List the board's listed digital products. Filter with `price`,
     * search with `q`, sort with `sort`, page with `cursor`.
     *
     * @example
     * const { data, nextCursor } = await board.products.list({ price: 'free' });
     */
    list(query?: ProductsListQuery, options?: FetchOptions) {
      return client.fetch<ProductCardListEnvelope>('/products', {
        ...options,
        query,
      });
    },

    /**
     * A product page by slug. Unlisted products answer by their exact slug
     * with `isListed: false`: keep those out of listings and sitemaps.
     *
     * @example
     * const product = await board.products.get('salary-guide');
     */
    get(slug: string, options?: FetchOptions) {
      return client.fetch<Product>(productBase(slug), options);
    },

    /**
     * A product's visible reviews, newest first. Empty when ratings are off.
     *
     * @example
     * const { data } = await board.products.reviews('salary-guide');
     */
    reviews(slug: string, query?: ProductReviewsQuery, options?: FetchOptions) {
      return client.fetch<ProductReviewListEnvelope>(
        `${productBase(slug)}/reviews`,
        { ...options, query },
      );
    },

    /**
     * Buy or claim a product. A free product returns `status: 'complete'`
     * with the download page path in `downloadUrl`; a paid one returns
     * `status: 'open'` with an embedded Stripe Checkout mount kit (it
     * expires after 30 minutes). Signed in, the purchase also lands in
     * `purchases.mine()`.
     *
     * @example
     * const result = await board.products.checkout('salary-guide', {
     *   email: 'ada@example.com',
     *   answers: [],
     * });
     * if (result.status === 'complete') redirect(result.downloadUrl!);
     */
    checkout(slug: string, body: ProductCheckoutBody, options?: FetchOptions) {
      return client.fetch<ProductCheckout>(`${productBase(slug)}/checkout`, {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * After Stripe returns the buyer (`session_id` on the return URL):
     * `awaiting_payment` until the payment lands, then `paid` with
     * `downloadUrl`. Poll briefly.
     *
     * @example
     * const s = await board.products.getCheckout('salary-guide', sessionId);
     * if (s.downloadUrl) redirect(s.downloadUrl);
     */
    getCheckout(slug: string, sessionId: string, options?: FetchOptions) {
      return client.fetch<ProductCheckoutStatus>(
        `${productBase(slug)}/checkout/${encodeURIComponent(sessionId)}`,
        options,
      );
    },
  };
}
