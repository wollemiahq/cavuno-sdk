---
name: cavuno-board-talent-access
description: Employer talent-access paywall with @cavuno/board. Use for charging models, remaining credits, per-candidate unlock gates, embedded checkout, in-place upgrades, or the company billing portal.
---

# Employer talent-access paywall

Operators sell access to the candidate directory: profile-unlock credits and/or first-message credits. Credits are company-scoped. This is a different buyer from the candidate job-access paywall (`board.me.access.*`, skill `cavuno-board-paywall`).

Two charging models (from `retrieve().accessModel`):

- `paid_messaging` — full profiles; a first cold message spends a message credit.
- `paid_unlocks_and_messaging` — directory cards redact; opaque `/p/{id}` requires an unlock credit; messaging stays credit-gated.

When no public `talent_access` plan exists, `accessModel` is `none` and the paywall is inert.

## Read the CTA and remaining credits

`board.me.talentAccess.retrieve()` is the gating signal for a Message-vs-upsell CTA. Never cache it.

```ts snippet
const access = await board.me.talentAccess.retrieve();
access.hasTalentAccess;
access.accessModel;
access.unlockCreditsRemaining;
access.messageCreditsRemaining;
access.hasUnlimitedUnlocks;
access.hasUnlimitedMessages;
access.companyId;
```

`companyId` is set when the viewer has exactly one approved membership. It is `null` when they have none or more than one — pass `companyId` on writes or the API returns `company_required`.

## Gate one candidate

Per-candidate already-unlocked state is a sibling read so the singleton never takes a candidate id.

```ts snippet
const gate = await board.me.talentAccess.retrieveCandidate('bu_candidate');
if (!gate.alreadyUnlocked && !gate.hasUnlimitedUnlocks) {
  renderUnlockCta(gate.unlockCreditsRemaining);
}
```

## Mint and mount checkout

`checkout` requires a signed-in approved employer and returns a mount kit. `returnPath` is relative; session metadata is `origin: talent_access`. Public talent plans come from `board.plans.list({ purpose: 'talent_access' })`.

```ts snippet
import { loadStripe } from '@stripe/stripe-js';

const kit = await board.me.talentAccess.checkout({
  planId: 'plan_1',
  returnPath: '/employers',
  colorMode: 'light',
});

const stripe = await loadStripe(kit.publishableKey, {
  stripeAccount: kit.stripeAccountId,
});
```

The kit contains `sessionId`, `clientSecret`, `stripeAccountId`, `publishableKey`, and `offerType`. The host owns Stripe.js and embedded-checkout mounting. Gate failures use `talent_access_unavailable`, `company_required`, and `stripe_not_connected`; handle them with `cavuno-board-errors`.

## Confirm from remaining credits

`retrieveCheckout` reports `open`, `complete`, or `expired`. Open sessions are remountable with their `clientSecret`; expired sessions require a new checkout. After completion, poll `retrieve()` because webhook delivery is asynchronous.

```ts snippet
const checkout = await board.me.talentAccess.retrieveCheckout(kit.sessionId);

if (checkout.status === 'complete') {
  let access = await board.me.talentAccess.retrieve();
  for (let poll = 0; !access.hasTalentAccess && poll < 10; poll++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    access = await board.me.talentAccess.retrieve();
  }
  if (access.hasTalentAccess) renderUnlockedDirectory();
  else renderPendingAccess();
}
```

## Spend an unlock

Unlock is idempotent: a second call for the same company/candidate pair returns `alreadyUnlocked: true` with no decrement.

```ts snippet
const unlock = await board.me.talentAccess.unlock({
  candidateId: 'bu_candidate',
});
if (unlock.alreadyUnlocked) renderProfile();
else renderProfile(unlock.unlockCreditsRemaining);
```

`talent_access_required` means no plan or no remaining unlock credits.

## Upgrade in place

Out-of-credits plan changes call `upgrade`, never a second checkout. Checkout would mint a parallel subscription.

```ts snippet
await board.me.talentAccess.upgrade({ planId: 'plan_pro' });
```

`already_on_plan` means the company already holds that plan. `talent_access_required` means there is no current talent_access subscription to swap.

## Open the company billing portal

Job-posting and talent-access subscriptions share one Stripe customer per company. There is no `me.talentAccess.portal`.

```ts snippet
const { url } = await board.me.companies.billingPortal.create('acme', {
  returnPath: '/employers/billing',
});
location.href = url;
```

## Message credits spend on start

There is no separate message-credit spend endpoint. The composer gates on `hasTalentAccess` and remaining message credits; `conversations.start` still 403s `messaging_talent_access_required` on a cold send without credit.

```ts snippet
await board.me.conversations.start({
  candidateBoardUserId: 'bu_candidate',
  body: 'Hi, your profile looks like a great fit.',
});
```

## Named vs opaque profile routes

Named `/p/{handle}` is the share bypass and always shows a full `public` profile. Opaque `/p/{id}` is the unlock-gated route. When `accessModel === 'paid_unlocks_and_messaging'`, directory cards redact for viewers who are not unlimited.

```ts snippet
const named = await board.talent.retrieve('jane-doe');
const opaque = await board.talent.retrieve('bu_candidate');
```

## Completion gate

- `retrieve()` drives the Message-vs-upsell CTA and remaining-credit hints.
- Opaque `/p/{id}` uses `retrieveCandidate` then `unlock`; named `/p/{handle}` does not.
- Checkout reaches `complete`, then bounded `retrieve()` polling reaches `hasTalentAccess: true`.
- `upgrade` is the out-of-credits plan swap; never a second checkout session.
- Billing management uses `me.companies.billingPortal.create`, not a talent-access portal.
- First-message spend stays on `conversations.start`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
