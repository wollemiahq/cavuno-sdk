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

## Render the form from the operator's layout

The operator orders the job form and chooses which fields show and which are required. `board.context().forms.job` is that form as one ordered list; render it top to bottom and never hard-code the order. Skip entries with `visible: false`: a hidden field is not collected and is never required.

```ts snippet
const { forms, jobForm } = await board.context();

for (const field of forms.job) {
  if (!field.visible) continue;
  switch (field.kind) {
    case 'builtin':
      renderBuiltin(field.key, { required: field.required, locked: field.locked });
      break;
    case 'custom':
      renderCustomField(field.definition, { required: field.required });
      break;
    case 'collection':
      renderCollectionPicker(field.definition, { required: field.required });
      break;
  }
}
```

A `builtin` entry is drawn by your own control for its `key`. A `locked` built-in is always shown and required; `lockReason` says why (for example `google_required` for the title and description Google for Jobs needs). Skip a built-in key you do not recognise. The keys map to submission fields:

| `key` | Submission fields |
| --- | --- |
| `employmentType` | `employmentType`, from `jobForm.employmentType.allowedOptions` |
| `seniority` | `seniority`, from `jobForm.seniority.allowedOptions` |
| `title` | `title` |
| `workArrangement` | `remoteOption`, from `jobForm.workArrangement.allowedOptions` |
| `location` | `officeLocations`, `inOfficePeriod`, `inOfficeFrequency` |
| `remoteEligibility` | `remoteWorkingPermits`, `remoteTimezones`, and `remoteSponsorship` when `jobForm.sponsorship.visible` |
| `description` | `description` |
| `salary` | `salaryRangeEnabled`, `salaryMin`, `salaryMax`, `salaryTimeframe`, `salaryCurrency` |
| `applyMethod` | `applicationUrl` |
| `company` | `companyName`, `companyWebsite`, and the resolved logo |

`contactName`, `contactEmail`, and the plan are not layout fields; always collect them. `jobForm` still carries each built-in's allowed options and salary bounds.

A `custom` entry renders from `definition` (`label`, `type`, `options`, `helpText`) and submits under `submission.customFieldValues[field.key]`; store option keys, never labels. A `collection` entry renders a picker capped by `definition.maxSelections` (one when `multiple` is false) with choices from `board.jobs.collectionChoices(field.key)`. The anonymous funnel takes no collection values, so collection fields belong on the signed-in employer job form (`board.me.companies.jobs.create`, `collectionValues`). Custom and collection rendering rules live in `cavuno-board-collections`.

When a collection definition has `allowOverrides`, the employer job form can give each selected entry its own wording for this job — "Unlimited PTO" in place of the shared "Annual leave", for example. Offer an edit action per selected entry with a title (up to 160 characters) and a plain-text description (up to 2,000 characters), and send them as `collectionOverrides`, one item per entry that has wording:

```ts snippet
const created = await board.me.companies.jobs.create('acme', {
  title: 'Head chef',
  description: 'Run the kitchen.',
  collectionValues: { benefits: [annualLeaveId] },
  collectionOverrides: [
    { fieldKey: 'benefits', recordId: annualLeaveId, title: 'Unlimited PTO' },
  ],
});

await board.me.companies.jobs.update('acme', created.id, {
  collectionOverrides: [],
});
```

The list replaces the job's wording: omit it on `update` to keep what is stored, and send `[]` to restore every default. Wording for an entry the job does not select, or on a field without `allowOverrides`, is rejected with `jobs_constraint_violation`; `details.violations[].params.fieldKey` names the field, so show the message under it. Deselecting an entry drops its wording. The job's collection entries then return the resolved `title` and `description` to render.

Validate `required` client-side from these entries before submitting, so the poster sees a missing field before the request.

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

- The form renders `forms.job` in order: hidden entries are absent, required and locked entries block submit while empty, and an unknown built-in key is skipped.
- Every `create` call handles all four statuses.
- Paid checkout redirects through `checkoutUrl`; the job appears only after webhook completion.
- Free unmoderated submission returns a resolving `jobSlug`.
- Missing domain logos leave submission usable without `logoUrl`.
- Existing credit is selectable only after token verification.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
