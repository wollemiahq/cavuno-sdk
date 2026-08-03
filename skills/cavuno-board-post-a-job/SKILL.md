---
name: cavuno-board-post-a-job
description: Post a job publicly with @cavuno/board. Use for plan selection, logos, checkout handoff, or verified existing credit.
---

# Status-first job posting

The public posting funnel is anonymous and rate-limited. Its invariant is status-first handling: `board.jobPosting.create` returns one of four success states, and the host follows that state. Rejected submissions throw `BoardApiError` instead.

Employer dashboard job management belongs to `board.me.companies.jobs.*`. Candidate access payments belong to `cavuno-board-paywall`.

## Select a plan

```ts snippet
const { data: plans } = await board.jobPosting.plans();
for (const plan of plans) {
  plan.id;
  plan.prices;
  plan.invoiceOnly;
  plan.isRecommended;
  plan.features;
}
```

Pass the chosen `plan.id` as `submission.selectedPlan`. Invoice-only plans collect `invoiceBilling` rather than immediate payment.

## Resolve a logo

Both logo paths return a stored `publicUrl` for `create`. The SDK owns multipart encoding.

```ts snippet
const uploaded = await board.jobPosting.uploadLogo(file);
const fetched = await board.jobPosting.fetchLogoByDomain('acme.com');
```

Uploads accept JPEG, PNG, WebP, or GIF up to 2 MB. A missing domain logo throws code `job_posting_logo_not_found`; continue without a logo.

## Submit and exhaust the result

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
  logoUrl: uploaded.publicUrl,
});

switch (result.status) {
  case 'checkout':
    location.href = result.checkoutUrl;
    break;
  case 'published':
    linkToJob(result.jobSlug);
    break;
  case 'pending_approval':
    showPending(result.jobId);
    break;
  case 'invoice_sent':
    showInvoiceSent(result.jobId);
    break;
}
```

The mapping is:

- paid Stripe plan → `checkout`;
- free or credited posting → `published`, or `pending_approval` on moderated boards;
- invoice plan → `invoice_sent`.

The checkout value is a URL for a host-owned full-page redirect. Payment publication happens by webhook; the SDK exposes no Stripe integration or publish-confirm method.

## Verified existing credit

Email verification protects billing ownership. Send verification first, then exchange the token for options; a selected option becomes `selectedBilling`.

```ts snippet
await board.jobPosting.sendBillingVerification({ email });

const { options } = await board.jobPosting.getBillingOptions({
  verificationToken,
});

const option = options[0];
if (option) {
  option.jobsRemaining;
  option.featuredRemaining;
  option.renewsAt;

  await board.jobPosting.create({
    submission,
    selectedBilling: {
      type: option.type,
      id: option.id,
      planId: option.planId,
    },
  });
}
```

Bare-email billing lookup is intentionally absent because it would expose whether an address holds credit.

## Completion gate

- Every `create` call handles all four statuses.
- Paid checkout redirects through `checkoutUrl`; the job appears only after webhook completion.
- Free unmoderated submission returns a resolving `jobSlug`.
- Missing domain logos leave submission usable without `logoUrl`.
- Existing credit is selectable only after token verification.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
