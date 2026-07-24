---
name: cavuno-board-job-posting
description: Build the anonymous "Post a job" funnel with the @cavuno/board SDK — jobPosting.plans, create and its status-discriminated JobPostingResult (checkout / published / pending_approval / invoice_sent), logo upload + fetchLogoByDomain, and the email-verified billing helpers (sendBillingVerification, getBillingOptions).
---

# Job posting: the anonymous submission funnel

The no-account "Post a job" wizard: pick a plan, upload a logo, submit — then branch on the status-discriminated result. Anonymous by design (no board-user token) and rate-limited server-side.

Out of scope — do not invent exports: the `checkout` branch returns a Stripe Checkout **URL** — the full-page redirect is host-app-owned, and the webhook publishes the job after payment. The SDK ships no Stripe code and no publish/confirm method for the paid path.

## When to use

- The public `/post` wizard: plan picker, logo step, submission, and the post-submit screen.
- Letting an existing plan/bundle holder submit against remaining capacity via email verification.

## When not to use

- Authenticated employer job management (drafts, edit, republish, ATS) — that is `board.me.companies.jobs.*`.
- The candidate-access paywall — see `cavuno-board-paywall`.

## Plans

The chosen plan's `id` goes in `submission.selectedPlan`:

```ts snippet
const { data: plans } = await board.jobPosting.plans();
for (const plan of plans) {
  plan.id;            // → submission.selectedPlan
  plan.prices;        // [{ currency, amountCents, isActive }]
  plan.invoiceOnly;   // collect invoiceBilling instead of paying now
  plan.isRecommended; // highlight in the picker
  plan.features;      // [{ key, value }] rows for the plan card
}
```

## Logo

Upload a file, or fetch by company domain (Brandfetch). Both return a stored `publicUrl` you pass back as `logoUrl` on `create(...)`:

```ts snippet
const logo = await board.jobPosting.uploadLogo(file); // JPEG/PNG/WebP/GIF, ≤2 MB
// or:
const fetched = await board.jobPosting.fetchLogoByDomain('acme.com');
// a BoardApiError code 'job_posting_logo_not_found' = no usable logo — continue without one
```

## Submit and branch on the result

`create` returns a `JobPostingResult` — a discriminated union on `.status` with exactly four variants. The host app **must** branch on it; a rejected submission throws a `BoardApiError` instead.

```ts snippet
const result = await board.jobPosting.create({
  submission: {
    companyName: 'Acme',
    contactName: 'Ada',
    contactEmail: 'ada@acme.com',
    title: 'Staff Engineer',
    description: '<p>…</p>',
    employmentType: 'full_time',
    remoteOption: 'remote',
    officeLocations: [],
    applicationUrl: 'https://acme.com/apply',
    salaryRangeEnabled: false,
    selectedPlan: plan.id,
  },
  logoUrl: logo.publicUrl,
});

switch (result.status) {
  case 'checkout':         // paid plan → send the poster to Stripe
    location.href = result.checkoutUrl; // webhook publishes on payment
    break;
  case 'published':        // live now
    result.jobSlug;        // link straight to the job
    break;
  case 'pending_approval': // moderated board — live after review
    result.jobId;
    break;
  case 'invoice_sent':     // invoice plan — a Stripe invoice was emailed
    result.jobId;
    break;
}
```

The five billing paths map onto those four statuses: paid-Stripe → `checkout`; free and existing bundle/subscription credit publish without payment (`published`, or `pending_approval` on moderated boards); invoice plans → `invoice_sent`.

## Existing credit: the verified-email branch

A submitter whose email already holds a plan/bundle can post against remaining capacity — no new charge. Verification is the gate: there is deliberately no pre-check by bare email (that would let anyone probe whether an address holds billing). Send the verification email, then read the options with the token; an option's fields become `selectedBilling`:

```ts snippet
await board.jobPosting.sendBillingVerification({ email }); // emails a token
// …the poster pastes/clicks the token…
const { options } = await board.jobPosting.getBillingOptions({
  verificationToken,
});
if (options.length > 0) {
  const option = options[0]!;
  option.jobsRemaining;     // capacity left
  option.featuredRemaining; // featured slots left
  option.renewsAt;

  await board.jobPosting.create({
    submission, // as above — selectedPlan not needed on this path
    selectedBilling: { type: option.type, id: option.id, planId: option.planId },
  });
}
```

## Verify

- [ ] Every `create` call site handles all four `result.status` variants — no fallthrough that assumes `published`.
- [ ] A paid-plan submission lands on Stripe via `result.checkoutUrl`, and the job appears on the board only after payment (webhook), not on redirect.
- [ ] A free-plan submission on an unmoderated board returns `published` with a `jobSlug` that resolves.
- [ ] `fetchLogoByDomain` on a bogus domain surfaces the not-found error path, and the wizard still submits without a logo.
