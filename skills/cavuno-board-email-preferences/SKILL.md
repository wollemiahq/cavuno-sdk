---
name: cavuno-board-email-preferences
description: Build the manage-email and unsubscribe page that the board's email footers link to, with board.emailPreferences from @cavuno/board. Use for the emailPreferences route role, the preferences token, switches for job alerts (all of them and each one), job matches, marketing and topics, and Unsubscribe from all.
---

# Email preferences page

Job alert digests, job match emails, and the confirmation emails for job alerts and marketing sign-ups have a footer link to the person's email preferences. One page covers their job alerts, weekly job matches, the board's marketing email and each marketing topic, and can unsubscribe them from all of it at once. `board.emailPreferences` reads and changes it; the person needs no sign-in, because the link carries their token.

Signed-in notification settings and per-channel unsubscribe links are in `cavuno-board-account`.

## Where the page lives

Serve the page at the `emailPreferences` route role, canonical path `BOARD_PATHS.emailPreferences` (`/email-preferences`). The role is optional: a board that does not declare it gets a page Cavuno hosts, and its emails link there instead. Once the board publishes with the role, its emails link to its own page. Mark the page `noindex`.

A site that declares the role also passes `emailPreferencesPath: '/email-preferences'` to `createGoHandler` from `@cavuno/board/go`. Without it, `/go/email-preferences` sends people to the Cavuno-hosted page instead of the site's own.

Keep the pages that older emails link to. `alertsManage` stays a required role (see `cavuno-board-job-alerts`), and links already sent keep their own tokens, which `board.emailPreferences` does not accept.

## The token

The link's `token` query parameter names the person on this board. Read it from the page URL and pass it to each method; the SDK sends it in the `X-Email-Preferences-Token` header, never in an API URL. Don't copy it into other links, analytics or logs.

```ts
const token = new URL(request.url).searchParams.get('token') ?? '';
const prefs = await board.emailPreferences.get(token);
```

`get` changes nothing, so it is safe in a loader: mail scanners open links before people do. Never change a preference when the page loads; every change is a click.

A missing token, one from another board, or one that was changed rejects with `email_preferences_token_invalid` (403). Show that the link is not valid, with no form.

## What to show

- **Job alerts** (`prefs.jobAlerts`): a Job alerts switch for all of them, on while `unsubscribed` is false, then each alert with its own switch and a Delete button.
  - An alert's switch is on while `paused` is false. Show every alert's switch as off, and disabled, while job alerts are off, as with topics and marketing.
  - Show `awaitingConfirmation` alerts as waiting for the person to click the link in the alert's confirmation email, not as sending, and give them no switch: the page can't start or pause them, only delete them. It stays true while job alerts are off; turning them back on emails a fresh link.
  - `waitlisted` means job alerts are on but wait for room on the board's plan; say so rather than showing them as sending. `isActive` is whether an alert is sending right now.
- **Job matches** (`prefs.jobMatches`): a switch. It is `null` when the board sends this person none; hide the switch then. `waitlisted` means it is on but waits for room on the board's plan.
- **Marketing** (`prefs.marketing.subscribed`): a switch, with the board's consent wording next to it.
- **Topics** (`prefs.topics`): a switch per live topic, by `name`. A topic narrows marketing, so show every topic as off, and its switch disabled, while marketing is off.
- **Unsubscribe from all**: a button that asks for confirmation first.

## Saving a change

`board.emailPreferences.update(token, changes)` applies the changes as the person and returns the preferences after them. Render the response; don't patch local state by hand.

Save each switch as the person clicks it, and send only what they changed:

- **Topics: send only the topic whose switch changed.** Never send the whole topic list on each save. A topic sent as `subscribed: false` is recorded as the person turning it off, so resending the off topics records refusals they never made, and those topics no longer come back with marketing.
- **Marketing back on restores its topics.** Turning marketing on brings back the topics that went off with it; someone who has never had a topic gets the topics the board adds to new sign-ups instead. Topics the person or the board's team removed one by one stay off. So send `marketing: true` alone and render the topics from the response.
- **Consent wording.** Turning marketing or a topic on is the person's own opt-in, confirmed at once because the link reached their inbox. Send the wording shown next to the marketing switch as `consentText`; for a topic, send that wording or a line that names the topic and the board. It must name the board; read the name from `board.context()`. Without it, or without the name, the request fails with `validation_bad_request` (400, `details.field: 'consentText'`). Add a `source` label for the page, such as `email-preferences`, and, from a server, `pageUrl` without the `token` parameter.
- **Job alerts switch.** `jobAlerts: false` turns every alert off, as the Unsubscribe button a digest's link opens does; `jobAlerts: true` brings back the alerts that were on before, not ones the person paused one by one. Alerts that wait for a confirmation link, including every alert of an address that never confirmed, come back `awaitingConfirmation` and a fresh link is emailed. The response's `confirmationEmailQueued` is true then: say a link is on its way only when it is true.
- **Alerts.** `{ id, paused: true }` pauses one alert and keeps its filters; `{ id, paused: false }` resumes it. One that waits for its confirmation link isn't paused. Resuming one that waits for its confirmation link, or while the person waits for room, leaves it waiting. `{ id, delete: true }` deletes an alert; `{ id, frequency: 'weekly' }` sends it weekly, and `'weekly'` is the value `frequency` takes.

```ts
const { name } = await board.context();

// The person turned marketing back on: send that alone.
const after = await board.emailPreferences.update(token, {
  marketing: true,
  consentText: `Send me news and offers from ${name}.`,
  source: 'email-preferences',
});

// The person turned one topic off: send that topic alone.
await board.emailPreferences.update(token, {
  topics: [{ key: 'hiring-tips', subscribed: false }],
});

// The person paused one alert.
await board.emailPreferences.update(token, {
  alerts: [{ id: alert.id, paused: true }],
});

// The person turned job alerts back on.
const back = await board.emailPreferences.update(token, { jobAlerts: true });
if (back.confirmationEmailQueued) {
  // Say a confirmation link is on its way; otherwise just "Saved."
}
```

Errors:

- `email_preferences_marketing_required` (409): a topic was turned on while marketing is off. Keep topic switches disabled while marketing is off.
- `candidate_notification_preference_paused` (422): job matches turned on for someone who has no job seeker account on the board (an email-only subscriber or an employer). Offer the switch only when `prefs.jobMatches` is not `null`.
- `subscribe_unknown_topic` (400): the topic key names no live topic. Reload the preferences.
- `job_alert_not_found` (404): the alert was already deleted, or job alerts were turned back on with alerts that wait for a confirmation link the board can't send. Nothing changed. Reload the preferences.
- `rate_limited` (429): job alerts turned back on, with alerts that wait for a confirmation link, within two minutes of the last link; nothing changed. Ask the person to try again shortly.
- `job_alert_email_suppressed` (409): the same, for an address that can't receive email, so no link was sent.
- `email_preferences_token_invalid` (403): the link is no longer valid.

## Unsubscribe from all

`board.emailPreferences.unsubscribeAll(token)` turns off job alerts, job matches, marketing and every topic at once and returns the preferences after it. Only what the person has is changed, so a repeat changes nothing, and the address can still sign up again later. Run it only from a click the person confirmed.

```ts
const cleared = await board.emailPreferences.unsubscribeAll(token);
```
