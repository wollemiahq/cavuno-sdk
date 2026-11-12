---
name: cavuno-board-newsletter
description: Newsletter sign-up forms with @cavuno/board. Use for an email sign-up for the board's news (footer, blog, landing page), its consent checkbox, the confirmation email, and sendingPaused.
---

# Newsletter sign-up

`board.subscribe` signs an address up for the board's own email (news, offers, updates). It is separate from job alerts (`board.jobAlerts.subscribe`): use it for a form whose promise is "get our news", not "get matching jobs".

Every sign-up is double opt-in. The person gets a confirmation email, and nothing is sent to them until they click it. The response is the same whether the address is new, waiting to confirm, or already subscribed, so it never tells a visitor who is on the list.

## The form

- An **unticked** checkbox the person must tick. Its wording must name the board, for example "Send me news and offers from Acme Jobs." Send that exact wording as `consentText`; it is kept as the record of what they agreed to, and a `consentText` without the board's name is refused with a 400.
- A `source` label for the form, such as `blog-footer` or `homepage-hero` (lowercase letters, digits and hyphens). It shows as the person's Source in the board's dashboard, so give each form its own.
- A hidden `website` field people leave empty. Bots fill it in; the API then answers as usual and does nothing.

Read the board's name from `board.context()` rather than typing it.

```ts snippet
const { name } = await board.context();
const consentText = `Send me news and offers from ${name}.`;

const result = await board.subscribe({
  email,
  consent: true,
  consentText,
  source: 'blog-footer',
  website: honeypotValue,
});

if (result.sendingPaused) {
  // Recorded, but the board's email is paused for now.
}
```

`pageUrl` is optional; it defaults to the request's `Referer`. Pass it when the call is made from your server, where the `Referer` is not the visitor's page.

## After submitting

Always show the same message: "Check your inbox to confirm your subscription." Never show "you're already subscribed"; the API deliberately doesn't say.

When `sendingPaused` is `true`, add a short note that emails from the board may be delayed. The sign-up is still recorded.

## Confirmation

The confirmation email links to the board's job alert confirmation page, the same page job alerts use. That page completes the sign-up with `board.jobAlerts.confirm({ token })`; no separate route is needed. `confirmed` and `already_confirmed` mean the person is subscribed, and `not_found` or `expired` mean the link no longer works.

The page serves both kinds of link, so word it by `subscription`. A newsletter link answers `subscription: 'marketing'` and never turns job alerts on, so don't tell that person their job alerts are confirmed:

```ts
const result = await board.jobAlerts.confirm({ token });
const subscribed =
  result.status === 'confirmed' || result.status === 'already_confirmed';
const message = !subscribed
  ? 'This link no longer works.'
  : result.subscription === 'marketing'
    ? "You're subscribed to our emails."
    : 'Your job alert is confirmed.';
```

## Errors

- `validation_bad_request` (400): a field is missing or malformed, `consent` isn't `true`, or `consentText` doesn't name the board.
- `rate_limited` (429): 3 sign-ups a minute per address across all boards, or 10 requests a minute per IP. A self-hosted site calls from its own server, so all its visitors share that IP limit with every other sign-in and sign-up call from that server; on a builder site Cavuno hosts it counts each visitor separately, plus 6 sign-ups a minute per visitor. `details.retryAfterSeconds` says when to try again.
- `rate_limit_unavailable` (503): retry shortly.

```ts snippet
import { BoardApiError } from '@cavuno/board';

try {
  await board.subscribe({ email, consent: true, consentText, source: 'footer' });
} catch (error) {
  if (error instanceof BoardApiError && error.status === 429) {
    // Ask them to try again in a minute.
  }
  throw error;
}
```
