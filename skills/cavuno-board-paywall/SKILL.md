---
name: cavuno-board-paywall
description: Grant-is-truth candidate paywall with @cavuno/board. Use for offers, gated job counts, embedded checkout handoff, access confirmation, or subscription portal links.
---

# Grant-is-truth candidate paywall

The candidate money flow is anonymous offers → authenticated embedded checkout → webhook-backed grant. The grant, rather than checkout completion, owns access.

Board-password access is a separate `X-Board-Access` mechanism. Employer posting payments use `cavuno-board-post-a-job`.

## Render offers and gating

`board.paywall.offers()` is anonymous and returns an empty list when disabled. Internal Stripe price ids stay server-side.

```ts snippet
const { data: offers } = await board.paywall.offers();
for (const offer of offers) {
  offer.offerKey;
  offer.label;
  offer.billingLabel;
  offer.amountCents;
  offer.currency;
  offer.offerType;
  offer.isDefault;
}
```

`offerType` is `'recurring' | 'lifetime'`; post the selected `offerKey` to checkout.

Gated catalog reads expose withheld inventory as `gatedCount`. The same jobs endpoint returns the entitled view when called with the candidate bearer token.

```ts snippet
const page = await board.jobs.list({ limit: 20 });
if ((page.gatedCount ?? 0) > 0) {
  renderUpsell(page.gatedCount);
}
```

## Mint and mount checkout

`board.me.access.checkout` requires a signed-in candidate profile and returns a mount kit. `returnPath` is relative; the server makes the canonical absolute return URL and appends Stripe's session placeholder.

```ts snippet
import { loadStripe } from '@stripe/stripe-js';

const kit = await board.me.access.checkout({
  offerKey: 'monthly',
  returnPath: '/account/access',
  colorMode: 'light',
});

const stripe = await loadStripe(kit.publishableKey, {
  stripeAccount: kit.stripeAccountId,
});
```

The kit contains `sessionId`, `clientSecret`, `stripeAccountId`, `publishableKey`, and `offerType`. The host owns Stripe.js, embedded-checkout mounting, and redirects. A repeated checkout POST safely creates another session that can expire unpaid.

## Confirm access from the grant

`retrieveCheckout` reports `open`, `complete`, or `expired`. Open sessions are remountable with their `clientSecret`; expired sessions require a new checkout. After completion, poll `grant()` within a bounded window because webhook delivery is asynchronous.

```ts snippet
const checkout = await board.me.access.retrieveCheckout(kit.sessionId);

if (checkout.status === 'complete') {
  let grant = await board.me.access.grant();
  for (let poll = 0; !grant.hasAccess && poll < 10; poll++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    grant = await board.me.access.grant();
  }
  if (grant.hasAccess) renderUnlockedJobs();
  else renderPendingAccess();
}
```

`grant()` always resolves: no access is `{ hasAccess: false }`. Its `status`, `offerType`, `currentPeriodEnd`, and `cancelAtPeriodEnd` drive the account UI. Gate failures use `paywall_disabled`, `paywall_no_candidate_profile`, `paywall_offer_not_found`, `paywall_already_active`, and `paywall_invalid_checkout_session`; handle them with `cavuno-board-errors`.

## Open the subscription portal

Only recurring grants have a portal. The host follows the returned Stripe-hosted URL.

```ts snippet
const grant = await board.me.access.grant();
if (grant.offerType === 'recurring') {
  const { url } = await board.me.access.portal({
    returnPath: '/account',
  });
  location.href = url;
}
```

A lifetime grant produces `paywall_no_recurring_subscription` for `portal`.

## Completion gate

- Anonymous offers render without authorization; disabled paywall renders no tiers.
- Unentitled jobs show `gatedCount`; the active-grant request exposes the full list.
- Test checkout reaches `complete`, then bounded grant polling reaches `hasAccess: true` after webhook delivery.
- UI access decisions read `grant().hasAccess`.
- Recurring grants open the portal; lifetime grants show a deliberate non-portal state.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
