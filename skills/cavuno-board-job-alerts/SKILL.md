---
name: cavuno-board-job-alerts
description: Build job-alert flows with the @cavuno/board SDK — the anonymous double-opt-in surface (jobAlerts.subscribe/confirm/resendConfirmation + HMAC-token manage/unsubscribe/resubscribe/updatePreference/deletePreference) and the authenticated board.me.alerts CRUD. Covers which surface to use when, how the manage token rides, which filters actually scope delivery, and the full-replace update trap.
---

# Job alerts: two surfaces

Two distinct surfaces. **Anonymous** (`board.jobAlerts.*`): email capture with double opt-in; later edits authenticate with an HMAC manage token from the digest email. **Authenticated** (`board.me.alerts.*`): CRUD for a signed-in board user (bearer token), active immediately — the authenticated action is the consent. Both are gated on `board.context()` → `features.jobAlerts`.

## When to use

- Anonymous: the "email me new jobs" capture form for visitors, the confirm landing page, and the manage/unsubscribe page linked from digest emails.
- Authenticated: an alerts section in the signed-in account area (up to 10 alerts per user).

## When not to use

- Board-user sign-in itself — see `cavuno-board-auth`.

## Out of scope — do not invent exports

Only the methods and fields shown here exist. There is no pause/suspend: deactivation is `unsubscribe` (anonymous) or `remove` (authenticated).

## Anonymous: subscribe → confirm

`subscribe` requires `consent: true` (server-enforced) and sends a confirmation email. `confirm` always returns HTTP 200 — branch on `status`.

```ts snippet
const sub = await board.jobAlerts.subscribe({
  email: 'ada@example.com',
  consent: true,
  frequency: 'weekly', // the only supported cadence
  filters: { jobFunctions: ['engineering'], remoteOptions: ['remote'], placeSlugs: ['berlin'] },
});
sub.status;               // always 'submitted' — uniform, never reveals new vs. already-subscribed

// Confirm page — token from the email link:
const res = await board.jobAlerts.confirm({ token });
res.status; // 'confirmed' | 'already_confirmed' | 'expired' | 'not_found'
if (res.status === 'expired') {
  await board.jobAlerts.resendConfirmation({ email }); // status: always 'submitted'
}
```

Filter caveat: only `jobFunctions`, `placeSlugs`, and `remoteOptions` scope the digest server-side; `seniorityLevels`/`salaryMin`/`salaryMax`/`salaryCurrency` are stored but do not filter delivery.

## Anonymous: the HMAC manage token

Digest emails carry a per-subscription HMAC token. **`manage` is a GET — the token rides as query params `{ subscription, token }`. All writes are POST/DELETE — the token rides in the JSON body as `{ subscriptionId, token }`** (note the different key: `subscription` on the query, `subscriptionId` in bodies). Each preference in the manage state also carries its own `manageToken`.

```ts snippet
// Manage page, from the email link's query string:
const state = await board.jobAlerts.manage({ subscription: subscriptionId, token });
state.email; state.confirmed; state.unsubscribed;
state.preferences; // [{ id, label, frequency, isActive, filters, manageToken }]

await board.jobAlerts.unsubscribe({ subscriptionId, token });
await board.jobAlerts.resubscribe({ subscriptionId, token });
await board.jobAlerts.deletePreference({ subscriptionId, preferenceId, token });
```

`unsubscribe`/`resubscribe` also accept an optional `preferenceId` to scope to one preference. `updatePreference` is a **full replace** — `frequency` is required every time; restate the filters you aren't editing or they reset:

```ts snippet
const pref = state.preferences[0];
await board.jobAlerts.updatePreference({
  subscriptionId,
  preferenceId: pref.id,
  token,
  frequency: 'weekly',   // required — restate even if unchanged
  filters: pref.filters, // round-trip stored filters you aren't editing
});
```

## Authenticated: board.me.alerts

Bearer-authenticated CRUD. Alerts are active on create (no opt-in email). The `AlertBody` uses `placeIds` (not `placeSlugs`), and `frequency` is required.

```ts snippet
const { data: alerts } = await board.me.alerts.list();
alerts[0].isActive; alerts[0].lastSentAt; alerts[0].filters;

const alert = await board.me.alerts.create({
  frequency: 'weekly',
  jobFunctions: ['engineering'],
  remoteOptions: ['remote'],
});

await board.me.alerts.remove(alert.id); // 204 → void; the only way to stop an alert
```

`update` is a PUT with **full-replace semantics** — the body is the same `AlertBody` as create, so round-trip every field you aren't changing:

```ts snippet
const current = await board.me.alerts.retrieve(alertId);
await board.me.alerts.update(alertId, {
  frequency: 'weekly',
  jobFunctions: current.filters.jobFunctions,
  seniorityLevels: current.filters.seniorityLevels,
  remoteOptions: current.filters.remoteOptions,
  placeIds: current.filters.placeIds,
  salaryMin: current.filters.salaryMin,
  salaryMax: current.filters.salaryMax,
  salaryCurrency: current.filters.salaryCurrency,
});
```

## Verify

- [ ] Subscribe form sends `consent: true` and shows a uniform "check your email" message on `status: 'submitted'` (never reveals already-subscribed).
- [ ] Confirm page branches on all four statuses (including `expired` → resend).
- [ ] Manage page reads `subscription` + `token` from the email link's query string; writes send `subscriptionId` in the body.
- [ ] Editing one preference field leaves the others intact (full-replace round-trip, both surfaces).
- [ ] Alert UI only promises filtering on job function / place / remote option.
- [ ] Alert UI offers weekly cadence only and never sends a legacy daily value.
- [ ] Alert surfaces are hidden when `features.jobAlerts` is false.
