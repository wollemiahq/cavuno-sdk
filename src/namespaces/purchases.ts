import type { BoardClient, FetchOptions } from '../client';
import type {
  Purchase,
  PurchaseConfirmation,
  PurchaseDownload,
  PurchaseDownloadAll,
  PurchaseRequestOptions,
  PurchaseResendBody,
  PurchaseResendResult,
  PurchaseReviewBody,
  PurchaseReviewResult,
  PurchaseSummaryListEnvelope,
} from '../types/products';

/** Header the API reads the email confirmation from. */
export const PURCHASE_CONFIRMATION_HEADER = 'x-cavuno-purchase-confirmation';

type PurchaseOptions = FetchOptions & PurchaseRequestOptions;

const purchaseBase = (token: string) =>
  `/purchases/${encodeURIComponent(token)}`;

/** Fold `confirmationToken` into the request headers. */
function withConfirmation(options: PurchaseOptions | undefined): FetchOptions {
  if (!options) return {};
  const { confirmationToken, ...rest } = options;
  if (!confirmationToken) return rest;
  const headers = new Headers(rest.headers);
  headers.set(PURCHASE_CONFIRMATION_HEADER, confirmationToken);
  return { ...rest, headers };
}

export function purchasesNamespace(client: BoardClient) {
  return {
    /**
     * Open a purchase's download page by its token. A shared link asks for
     * the purchase email (`purchase_email_confirmation_required`, 403): call
     * `confirmEmail`, keep the `confirmationToken` it returns, and pass it
     * back on later calls.
     *
     * @example
     * const purchase = await board.purchases.get(token, { confirmationToken });
     */
    get(token: string, options?: PurchaseOptions) {
      return client.fetch<Purchase>(
        purchaseBase(token),
        withConfirmation(options),
      );
    },

    /**
     * Confirm the purchase email on a shared link. Returns the
     * `confirmationToken` to pass on later calls for this purchase.
     *
     * @example
     * const { confirmationToken } = await board.purchases.confirmEmail(token, {
     *   email: 'ada@example.com',
     * });
     */
    confirmEmail(
      token: string,
      body: { email: string },
      options?: FetchOptions,
    ) {
      return client.fetch<PurchaseConfirmation>(
        `${purchaseBase(token)}/confirm`,
        { ...options, method: 'POST', body },
      );
    },

    /**
     * Count one download of a file and get a signed, short-lived link.
     * `purchase_file_preparing` (409) while the buyer's stamped copy is made
     * (they are emailed when it is ready); `purchase_download_limit_reached`
     * (409) when no downloads are left (only the board can reset it).
     *
     * @example
     * const { url } = await board.purchases.download(token, fileId);
     */
    download(token: string, fileId: string, options?: PurchaseOptions) {
      return client.fetch<PurchaseDownload>(
        `${purchaseBase(token)}/files/${encodeURIComponent(fileId)}/download`,
        { ...withConfirmation(options), method: 'POST' },
      );
    },

    /**
     * Count every ready file and get a short-lived link to one streamed ZIP.
     * Offer it only while the page's `downloadAllAvailable` is true: files
     * totalling more than 500 MB are refused, with nothing counted, as
     * `409 purchase_download_all_unavailable` (download them one by one).
     *
     * @example
     * const { url } = await board.purchases.downloadAll(token);
     */
    downloadAll(token: string, options?: PurchaseOptions) {
      return client.fetch<PurchaseDownloadAll>(
        `${purchaseBase(token)}/download-all`,
        { ...withConfirmation(options), method: 'POST' },
      );
    },

    /**
     * Write or replace the buyer's review (1 to 5 stars).
     *
     * @example
     * await board.purchases.review(token, { stars: 5, comment: 'Useful' });
     */
    review(token: string, body: PurchaseReviewBody, options?: PurchaseOptions) {
      return client.fetch<PurchaseReviewResult>(
        `${purchaseBase(token)}/review`,
        {
          ...withConfirmation(options),
          method: 'PUT',
          body,
        },
      );
    },

    /**
     * "Email me this link again". Always accepted, whether or not the email
     * holds a purchase.
     *
     * @example
     * await board.purchases.resend({ email: 'ada@example.com' });
     */
    resend(body: PurchaseResendBody, options?: FetchOptions) {
      return client.fetch<PurchaseResendResult>('/purchases/resend', {
        ...options,
        method: 'POST',
        body,
      });
    },

    /**
     * The signed-in user's purchases (by account and verified email), each
     * with its download page path. Requires a board user session.
     *
     * @example
     * const { data } = await board.purchases.mine();
     */
    mine(options?: FetchOptions) {
      return client.fetch<PurchaseSummaryListEnvelope>(
        '/me/purchases',
        options,
      );
    },
  };
}
