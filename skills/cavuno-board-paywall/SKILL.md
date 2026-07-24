---
name: cavuno-board-paywall
description: Build the candidate job-access paywall with the @cavuno/board SDK — anonymous offer reads (paywall.offers), the gated browse experience (gatedCount on job lists), the embedded Stripe checkout mount kit (me.access.checkout → retrieveCheckout → grant), and the billing portal (me.access.portal for recurring grants).
---

# Candidate paywall: offers, checkout, grant

The candidate-facing money flow: anonymous pricing, gated job lists, and an embedded Stripe checkout that ends in an access grant.

Out of scope — do not invent exports: the SDK is Stripe-agnostic. It returns a *mount kit*; loading Stripe.js (`loadStripe`, `initEmbeddedCheckout`) and every redirect is host-app-owned. There is no SDK helper that mounts, redirects, or handles webhooks.

## When to use

- The pricing/upsell page, the gated jobs view, the checkout page, and the "manage subscription" button.

## When not to use

- Board-password gating (`X-Board-Access`) — unrelated; see `cavuno-board-errors`.
- Employer job-posting payments — see `cavuno-board-job-posting`.

## Offers (anonymous)

`board.paywall.offers()` lists the enabled offer tiers — public, no auth. Returns `[]` when the paywall is disabled (the internal Stripe price id is never exposed).

```ts snippet
const { data: offers } = await board.paywall.offers();
for (const offer of offers) {
  offer.offerKey;     // e.g. 'monthly' — what you post to checkout
  offer.label;
  offer.billingLabel;
  offer.amountCents;
  offer.currency;
  offer.offerType;    // 'recurring' | 'lifetime'
  offer.isDefault;    // pre-select this tier
}
```

## The gated browse: gatedCount

On gated boards the jobs catalog reads (browse / search / company-jobs) withhold results from unentitled viewers and report how many via `gatedCount` on the envelope. Surface it as the upsell:

```ts snippet
const page = await board.jobs.list({ limit: 20 });
if (page.gatedCount && page.gatedCount > 0) {
  // "Unlock N more roles" → link to the offers page
}
```

The same call with an entitled board-user bearer token returns the ungated view — one URL for both.

## Checkout: mint the mount kit

`board.me.access.checkout` (signed-in, candidate profile required) starts an embedded checkout and returns a connected-account mount kit — `{ sessionId, clientSecret, stripeAccountId, publishableKey, offerType }`. `returnPath` is relative-only; the server resolves it against the board's canonical host and appends `?session_id={CHECKOUT_SESSION_ID}`.

```ts snippet
import { loadStripe } from '@stripe/stripe-js'; // host-app dependency

const kit = await board.me.access.checkout({
  offerKey: 'monthly',           // the chosen PaywallOffer.offerKey
  returnPath: '/account/access', // relative path Stripe returns to
  colorMode: 'light',
});

// Host-owned mounting — stripeAccount is required for connected-account embeds:
const stripe = await loadStripe(kit.publishableKey, {
  stripeAccount: kit.stripeAccountId,
});
```

Duplicate POSTs are benign (a second session simply expires unpaid) — no idempotency machinery needed.

## Completion: poll the session, confirm the grant

`retrieveCheckout(sessionId)` reports `open` (re-mountable — `clientSecret` set), `complete`, or `expired`. On completion, the entitlement lands via webhook within seconds — `grant()` is the source of truth, and it always resolves (no access is `hasAccess: false`, not an error):

```ts snippet
const state = await board.me.access.retrieveCheckout(kit.sessionId);
// 'open'     → remount with state.clientSecret
// 'expired'  → mint a fresh session
// 'complete' → poll the grant until the webhook lands:

const grant = await board.me.access.grant();
grant.hasAccess;         // gate the ungated jobs view on this
grant.status;            // 'active' | 'past_due' | … | null
grant.offerType;         // 'recurring' | 'lifetime' | null
grant.currentPeriodEnd;
grant.cancelAtPeriodEnd;
```

Gate failures throw `paywall_*` codes (`paywall_disabled`, `paywall_no_candidate_profile`, `paywall_offer_not_found`, `paywall_already_active`, `paywall_invalid_checkout_session`) — branch with the guards from `cavuno-board-errors`.

## Manage subscription: portal

Only `recurring` grants get a portal (`paywall_no_recurring_subscription` otherwise). Unlike checkout, the portal IS a redirect flow — the host app navigates to the Stripe-hosted URL:

```ts snippet
if (grant.offerType === 'recurring') {
  const { url } = await board.me.access.portal({ returnPath: '/account' });
  location.href = url; // host-owned redirect to Stripe's portal
}
```

## Verify

- [ ] Anonymous fetch of `paywall.offers()` renders tiers with no auth header; a paywall-disabled board renders none (`data: []`).
- [ ] As an unentitled viewer, `board.jobs.list` carries `gatedCount > 0` and the upsell shows; with an active grant the same call returns `gatedCount` absent/0 and the full list.
- [ ] Complete a test payment: `retrieveCheckout` flips to `complete` and `grant().hasAccess` turns true within seconds (webhook latency), not instantly.
- [ ] `portal()` succeeds for a recurring grant and throws for a lifetime one.
