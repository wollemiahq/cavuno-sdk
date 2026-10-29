---
name: cavuno-board-products
description: Digital product storefront with @cavuno/board. Use for product lists and pages, reviews, free claims, embedded paid checkout, the purchase download page with its email confirmation, downloads, buyer reviews, resending the link, or the signed-in buyer's purchases.
---

# Digital product storefront

Operators create products in the Cavuno dashboard or the Operator API. The frontend lists them, sells them and serves the buyer's download page. `board.products` covers the catalogue and checkout; `board.purchases` covers everything after the purchase, keyed by the purchase token in the buyer's download link.

Routes: `BOARD_PATHS.products` (`/products`), `productPath(slug)`, the download page at `purchasePath(token)`, and `BOARD_PATHS.mePurchases` (`/me/purchases`), all from `@cavuno/board/paths`. Link to the `downloadUrl` the API returns instead of building the download path: it follows the board's route manifest.

## List and render products

```ts snippet
const { data: products, nextCursor } = await board.products.list({
  sort: 'featured', // 'newest' | 'rating' | 'price_asc'
  price: 'paid', // or 'free'; omit for both
  limit: 24,
});

const product = await board.products.get('salary-guide');
if (product.ratingsEnabled) {
  const { data: reviews } = await board.products.reviews('salary-guide');
}
```

Only listed products appear in `list`; show a Products nav item only when it returns any. `get` also answers for an unlisted product by its exact slug: render it, but keep `isListed: false` pages out of lists, sitemaps and search indexes. An unknown, archived or undeliverable product is `products_not_found` (404). `price.kind` is `free`, `fixed` or `pay_what_you_want` (`amountCents` is the minimum, `suggestedCents` the prefill). `details` rows are `kind: 'text'` (`label`, `value`) or `kind: 'check'` (`label`, `checked`): render a check row as a tick or a cross with "Yes"/"No" as its accessible text, not as a word. Catalogue reads are public and cacheable.

## Checkout: free and paid

Collect the email and the answers to `product.questions` (text → string, checkbox → boolean, dropdown → one of `options`) in your own form, then call `checkout` from the server.

```ts snippet
const result = await board.products.checkout('salary-guide', {
  email: 'ada@example.com',
  answers: [{ questionId: 'waiver', value: true }],
  jobAlertOptIn: false, // free products only; render unticked
  returnPath: '/products/salary-guide',
  website: '', // honeypot: render hidden, send empty
});

if (result.status === 'complete') {
  redirect(result.downloadUrl); // free claim recorded and emailed
} else {
  mountEmbeddedCheckout(result); // paid: Stripe mount kit
}
```

`status: 'open'` returns `publishableKey`, `stripeAccountId`, `clientSecret` and `sessionId`. Mount with `loadStripe(publishableKey, { stripeAccount: stripeAccountId })` and `initEmbeddedCheckout({ clientSecret })`. The session expires after 30 minutes. For pay what you want, send `amountCents` (at least the minimum) or omit it to let the buyer choose on Stripe's page; `amountCents: 0` on a $0+ product is a free claim.

After Stripe returns with `session_id`, poll briefly:

```ts snippet
const status = await board.products.getCheckout('salary-guide', sessionId, {
  cache: 'no-store',
});
if (status.status === 'paid') redirect(status.downloadUrl);
// still 'awaiting_payment' after ~10 s: "We have emailed your download link"
```

Checkout errors: `product_sold_out` (409), `product_email_invalid` (400), `product_email_blocked` (403), `product_amount_below_minimum` (400, `details.minimumCents`), `product_amount_invalid` (400), `product_answers_invalid` (400, `details.questionId`), `stripe_not_connected` (409), `rate_limited` (429), `rate_limit_unavailable` (503); `getCheckout` with an unknown session is `product_checkout_not_found`.

## Download page and the shared-link check

The token is the buyer's credential: `no-store`, `noindex`, and never in analytics, sitemaps or cache keys. The buyer's first open and a signed-in buyer pass; a forwarded link gets `purchase_email_confirmation_required` (403). A server-side frontend never forwards the API's confirmation cookie, so keep the returned `confirmationToken` in your own per-purchase cookie and pass it back as the `confirmationToken` option (sent as `PURCHASE_CONFIRMATION_HEADER`).

```ts snippet
import { isBoardApiError } from '@cavuno/board';

try {
  const purchase = await board.purchases.get(token, {
    confirmationToken,
    cache: 'no-store',
  });
  if (purchase.confirmationToken) saveConfirmation(purchase.confirmationToken);
} catch (error) {
  if (
    isBoardApiError(error) &&
    error.code === 'purchase_email_confirmation_required'
  ) {
    renderEmailPrompt(); // then:
    const confirmation = await board.purchases.confirmEmail(token, {
      email: typedEmail,
    }); // purchase_email_mismatch (403) on a wrong email
    saveConfirmation(confirmation.confirmationToken);
  } else throw error;
}
```

`purchase.files` holds files (`state`: `ready`, `preparing`, `limit_reached`; `downloadsLeft`, `sizeBytes`, `pageCount`, `stamped`) and links (`url`, opened directly). Also `downloadCap`, `stamping`, `receiptUrl` (null for free), `refundPolicy`, `ratingsEnabled` and the buyer's own `review`.

## Downloads

Each call counts a download, so trigger it from a button, then redirect to the short-lived signed `url` at once.

```ts snippet
const { url } = await board.purchases.download(token, fileId, {
  confirmationToken,
});
const zip = await board.purchases.downloadAll(token, { confirmationToken });
// zip.preparing / zip.limitReached: file ids left out of the ZIP
```

`purchase_file_preparing` (409): the stamped PDF is being made, nothing counted, the buyer is emailed when ready. `purchase_download_limit_reached` (409): permanent until the board resets it; never retry it as a rate limit. `purchase_download_all_unavailable` (503): offer single files. Also `purchase_awaiting_payment` (409), `purchase_access_removed` (410), `purchase_unavailable` (410), `purchase_file_not_found` and `purchases_not_found` (404). Purchase-token routes ignore the board password and plan gates.

## Reviews, resend and the library

```ts snippet
await board.purchases.review(
  token,
  { stars: 5, comment: 'Exactly what I needed' }, // displayName optional
  { confirmationToken });

await board.purchases.resend({
  email: 'ada@example.com',
  productSlug: 'salary-guide',
  website: '',
}); // always 202: never reveals whether a purchase exists

const { data: mine } = await board.purchases.mine({ cache: 'no-store' });
```

`review` replaces the buyer's earlier review; `product_reviews_disabled` (404) when ratings are off, `purchase_refunded` (409), `purchase_review_invalid` (400). `mine` needs a board user session and lists purchases made while signed in plus those made with the user's verified email, each with `downloadUrl`.

## Completion gate

- The list shows listed products only; a link-only product page renders with `noindex`.
- A free claim redirects to `downloadUrl`; a paid test checkout mounts, returns with `session_id`, and `getCheckout` reaches `paid`.
- A forwarded download link asks for the email, and the confirmation survives a reload through your own cookie.
- Downloads start from a button; `purchase_download_limit_reached` disables the button instead of retrying.
- Download pages, checkout status and `mine()` are `no-store`; purchase paths never reach analytics or the sitemap.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk/build-your-board/digital-products).
