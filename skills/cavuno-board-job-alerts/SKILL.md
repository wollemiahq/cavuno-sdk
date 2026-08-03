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

const alert = await board.me.alerts.create({
  frequency: 'weekly',
  jobFunctions: ['engineering'],
  remoteOptions: ['remote'],
});

const current = await board.me.alerts.retrieve(alert.id);
await board.me.alerts.update(alert.id, {
  frequency: 'weekly',
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
