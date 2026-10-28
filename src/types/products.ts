// Digital product and purchase types. Response and body entities alias the
// generated OpenAPI components; the query types stay hand-written. The SDK
// stays Stripe-agnostic: a paid checkout is a connected-account mount kit.
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';

/** A product card in `products.list`. */
export type ProductCard = Schemas['ProductCard'];

/** A product page (`products.get`). */
export type Product = Schemas['ProductDetail'];

/**
 * A row of a product page's facts box. `kind: 'text'` shows `value`;
 * `kind: 'check'` is a yes/no row: render a tick for `checked: true` and a
 * cross for `false`, not the words Yes or No.
 */
export type ProductDetailRow = Schemas['ProductDetailRow'];

/** The price model of a product. */
export type ProductPrice = Schemas['ProductPrice'];

/** A question the buyer answers at checkout. */
export type ProductQuestion = Schemas['ProductQuestion'];

/** A visible review (`products.reviews`). */
export type ProductReview = Schemas['ProductReview'];

/** Body for `products.checkout`. */
export type ProductCheckoutBody = Schemas['ProductCheckoutBody'];

/**
 * `products.checkout` result: `status: 'complete'` (free claim; send the
 * buyer to `downloadUrl`) or `status: 'open'` (mount the embedded Stripe
 * Checkout with `publishableKey`, `stripeAccountId` and `clientSecret`).
 */
export type ProductCheckout = Schemas['ProductCheckout'];

/** `products.getCheckout` result, after Stripe returns the buyer. */
export type ProductCheckoutStatus = Schemas['ProductCheckoutStatus'];

/** A purchase's download page (`purchases.get`). */
export type Purchase = Schemas['Purchase'];

/** `purchases.confirmEmail` result. */
export type PurchaseConfirmation = Schemas['PurchaseConfirmation'];

/** `purchases.download` result: a signed, short-lived link. */
export type PurchaseDownload = Schemas['PurchaseDownload'];

/** `purchases.downloadAll` result: a short-lived ZIP link. */
export type PurchaseDownloadAll = Schemas['PurchaseDownloadAll'];

/** Body for `purchases.review`. */
export type PurchaseReviewBody = Schemas['PurchaseReviewBody'];

/** `purchases.review` result. */
export type PurchaseReviewResult = Schemas['PurchaseReviewResult'];

/** Body for `purchases.resend`. */
export type PurchaseResendBody = Schemas['PurchaseResendBody'];

/** `purchases.resend` result (always accepted). */
export type PurchaseResendResult = Schemas['PurchaseResendResult'];

/** One row of the signed-in user's library (`purchases.mine`). */
export type PurchaseSummary = Schemas['PurchaseSummary'];

export type ProductsListQuery = {
  /** Search words; every word must appear in the name or summary. */
  q?: string;
  price?: 'free' | 'paid';
  sort?: 'featured' | 'newest' | 'rating' | 'price_asc';
  cursor?: string;
  /** 1 to 50 (default 20). */
  limit?: number;
};

export type ProductReviewsQuery = {
  cursor?: string;
  /** 1 to 50 (default 20). */
  limit?: number;
};

/**
 * Options on every purchase-token call. `confirmationToken` is the value a
 * previous response returned; a frontend that calls the API from its server
 * keeps it (for example in its own cookie) and passes it back so a shared
 * link does not ask for the email again.
 */
export type PurchaseRequestOptions = {
  confirmationToken?: string | null;
};

export type ProductCardListEnvelope = ListEnvelope<ProductCard>;
export type ProductReviewListEnvelope = ListEnvelope<ProductReview>;
export type PurchaseSummaryListEnvelope = ListEnvelope<PurchaseSummary>;
