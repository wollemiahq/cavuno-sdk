---
name: cavuno-board-job-alerts
description: Job-alert two-lane model with @cavuno/board. Use for anonymous double opt-in, token-managed preferences, or signed-in alert CRUD.
---

# Job-alert two-lane model

Choose exactly one lane:

- Anonymous visitors use `board.jobAlerts.*`: double opt-in, then an HMAC manage token from email.
- Signed-in users use `board.me.alerts.*`: bearer-authenticated CRUD, active immediately, with up to 10 alerts per user.

Both lanes are available only when `board.context()` reports `features.jobAlerts`.

## Anonymous lane: subscribe and confirm

`subscribe` requires consent and deliberately returns the same submitted response for new and existing addresses. `confirm` always resolves; its status owns the landing-page branch.

```ts snippet
const submitted = await board.jobAlerts.subscribe({
  email: 'ada@example.com',
  consent: true,
  frequency: 'weekly',
  filters: {
    jobFunctions: ['engineering'],
    remoteOptions: ['remote'],
    placeSlugs: ['berlin'],
  },
});

const result = await board.jobAlerts.confirm({ token });
switch (result.status) {
  case 'confirmed':
  case 'already_confirmed':
  case 'not_found':
    break;
  case 'expired':
    await board.jobAlerts.resendConfirmation({ email });
    break;
}
```

Only `jobFunctions`, `placeSlugs`, and `remoteOptions` filter digest delivery. Seniority and salary fields are stored but do not scope delivery. The supported cadence is `weekly`.

`jobFunctions` are category and skill slugs (the `slug` of a category or skill, such as `engineering` or `media-and-communication`). A digest matches a job when any entry equals one of the job's category or skill slugs. Prefer sending slugs. If you send display names or free-text keywords instead, the server slugifies each one when the alert is saved and matches it against the board's category and skill slugs, their aliases, and their board-language slugs. A display name that does not slugify to one of those (for example, a renamed category) is stored slugified and will not match, so send slugs whenever you have them. Alerts read back from the API therefore always carry slugs, so compare and display them as slugs.

## Alert kinds, keywords, and anchor jobs

Every alert read back from either lane carries a read-only `kind`:

- `similar_job`: jobs similar to the job the visitor subscribed from. Subscribe from a job page with `context: { source: 'job_detail', jobId }` (or `job_apply_dialog`). `anchorJob` is that job as `{ id, slug, title }`, kept after the job closes. It is `null` for other kinds, and for an older similar-job alert whose job has not been captured yet.
- `search`: a board search for the alert's keywords, in `filters.query`. An older search alert can report `kind: 'search'` with `filters.query` `null`: its keyword is the single `jobFunctions` entry. When `query` is `null`, show the job functions as the alert's search instead.
- `filters`: jobs matching the stored filters exactly.

Send the query a search page ran as `filters.query` (on `board.me.alerts`, the top-level `query`), at most 200 characters after trimming. Keep sending the location and other filters alongside it.

```ts snippet
await board.jobAlerts.subscribe({
  email: 'ada@example.com',
  consent: true,
  filters: { query: 'Python developer', placeSlugs: ['berlin'] },
  context: { source: 'jobs_list' },
});
```

A sent `query` is stored as given (trimmed), so `front-end` reads back as `front-end`. A job-page `context` without a `jobId` cannot anchor a similar-job alert; with a `query` it makes a `search` alert. A client that predates `query` and sends the search keyword as its single `jobFunctions` entry, with a search-page `context.source`, still works: the server keeps that keyword as the alert's `query`.

On an update, `null` clears `query`, and omitting it keeps the stored keywords as long as `jobFunctions` are unchanged. An update never changes `kind`, except that giving a `filters` alert a `query` makes it a `search` alert. A `similar_job` alert takes no `query`: sending one, on subscribe with a job-page `context` or on an update, fails with `validation_bad_request` (400). To follow keywords instead, remove the similar-job alert and create a search alert. In alert lists, show the kind and, for similar-job alerts, link the anchor job.

## Anonymous lane: manage-token transport

The read and write transports intentionally use different keys:

- `manage` is GET with query `{ subscription, token }`.
- Writes carry `{ subscriptionId, token }` in their body.

```ts snippet
const state = await board.jobAlerts.manage({
  subscription: subscriptionId,
  token,
});
state.email;
state.confirmed;
state.unsubscribed;
state.preferences;

await board.jobAlerts.unsubscribe({ subscriptionId, token });
await board.jobAlerts.resubscribe({ subscriptionId, token });
await board.jobAlerts.deletePreference({
  subscriptionId,
  preferenceId,
  token,
});
```

`unsubscribe` and `resubscribe` accept an optional `preferenceId`. Each managed preference also includes its own `manageToken`.

`updatePreference` is a full replacement. Round-trip every retained value and always send `frequency`.

```ts snippet
const preference = state.preferences[0]!;
await board.jobAlerts.updatePreference({
  subscriptionId,
  preferenceId: preference.id,
  token,
  frequency: 'weekly',
  filters: preference.filters,
});
```

## Signed-in lane

Authenticated alerts use `placeIds`, while anonymous alerts use `placeSlugs`. Create and update accept the same `AlertBody`; update is a full replacement.

```ts snippet
const { data: alerts } = await board.me.alerts.list();
alerts[0]?.isActive;
alerts[0]?.lastSentAt;
alerts[0]?.filters;
alerts[0]?.kind;
alerts[0]?.anchorJob;

const alert = await board.me.alerts.create({
  frequency: 'weekly',
  query: 'Platform engineer',
  remoteOptions: ['remote'],
});

const current = await board.me.alerts.retrieve(alert.id);
await board.me.alerts.update(alert.id, {
  frequency: 'weekly',
  query: current.filters.query,
  jobFunctions: current.filters.jobFunctions,
  seniorityLevels: current.filters.seniorityLevels,
  remoteOptions: current.filters.remoteOptions,
  placeIds: current.filters.placeIds,
  salaryMin: current.filters.salaryMin,
  salaryMax: current.filters.salaryMax,
  salaryCurrency: current.filters.salaryCurrency,
});

await board.me.alerts.remove(alert.id);
```

Removal is the signed-in lane's stop action; there is no pause state.

## Completion gate

- The feature flag hides both lanes when disabled.
- Anonymous subscribe sends `consent: true` and reveals no subscription existence.
- The confirm UI handles all four statuses, including resend after expiry.
- Manage reads use `subscription`; manage writes use `subscriptionId`.
- Editing one field preserves every other field in both full-replace APIs.
- UI promises only weekly delivery filtered by job function, place, and remote option.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
