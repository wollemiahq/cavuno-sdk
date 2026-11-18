---
name: cavuno-board-newsletter
description: Newsletter sign-up forms with @cavuno/board. Use for an email sign-up for the board's news (footer, blog, landing page), its consent checkbox, topic checkboxes and tags, the confirmation email, and sendingPaused.
---

# Newsletter sign-up

`board.subscribe` signs an address up for the board's own email (news, offers, updates). It is separate from job alerts (`board.jobAlerts.subscribe`): use it for a form whose promise is "get our news", not "get matching jobs".

Every sign-up is double opt-in. The person gets a confirmation email, and nothing is sent to them until they click it. The response is the same whether the address is new, waiting to confirm, or already subscribed, so it never tells a visitor who is on the list.

## The form

- An **unticked** checkbox the person must tick. Its wording must name the board, for example "Send me news and offers from Acme Jobs." Send that exact wording as `consentText`; it is kept as the record of what they agreed to, and a `consentText` without the board's name is refused with a 400.
- A `source` label for the form, such as `blog-footer` or `homepage-hero` (lowercase letters, digits and hyphens). It shows as the person's Source in the board's dashboard, so give each form its own.
- A hidden `website` field people leave empty. Bots fill it in; the API then answers as usual and does nothing.
- The person's time zone as `timeZone`: read `Intl.DateTimeFormat().resolvedOptions().timeZone` in their browser (such as `Europe/Berlin`) and send it with the form. On your server it returns the server's zone, so never fill it in there. The board keeps the first value it gets for a person and ignores an invalid one.

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
  timeZone: browserTimeZone, // read in the browser, sent with the form
});

if (result.sendingPaused) {
  // Recorded, but the board's email is paused for now.
}
```

`pageUrl` is optional; it defaults to the request's `Referer`. Pass it when the call is made from your server, where the `Referer` is not the visitor's page.

## Topics

A board can split its email into topics, such as a weekly newsletter and employer updates. List them with `board.marketingTopics.list()` and send the keys the person ticked as `topics`. The list is empty when the board has a single list; then leave `topics` out.

```ts snippet
const { data: topics } = await board.marketingTopics.list();
// Render one unticked checkbox per topic, labelled with topic.name.

await board.subscribe({
  email,
  consent: true,
  consentText: `Send me the weekly newsletter from ${name}.`,
  source: 'newsletter-page',
  topics: ['weekly-newsletter'], // the keys the person ticked
});
```

- A form for one topic sends that one key, and its wording names the topic as well as the board.
- Without `topics`, the person gets every topic the board adds to new sign-ups. With `topics`, they get only those.
- A key that isn't one of the board's live topics is refused with 400 `subscribe_unknown_topic` (`details.key` names it). A topic must exist before a form uses it: create it in Settings › Email or with `POST /v1/marketing-topics` (operator API), never by guessing a key.
- Topics wait for the confirmation click like the sign-up itself. Someone who already gets the board's email gets a new topic at once; a topic they removed themselves comes back only through the confirmation email.

## Tags

`tags` labels the person for the board's team, such as `audience:employer` (up to 10: lowercase letters, digits, `_` and `-`, with one optional `namespace:` part). An unknown tag is created. Tags are added with the confirmation click, or at once for someone who already gets the board's email. A board holds 500 tags; past that, `result.tagsSkipped` lists the ones that won't be added, and the sign-up still goes through.

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

## Mistyped email addresses

Under the email field, offer a one-tap fix for a mistyped domain: `suggestEmailAddress` from `@cavuno/board/email` compares the domain with common mailbox providers and returns the corrected address, or `null`. It never changes the part before the @, and it runs in the browser, so call it on blur. The API also refuses an address whose domain has no mail server (no MX, A or AAAA record) with 422 `email_domain_undeliverable`, before anything is created or emailed; `details.suggestion` carries the same correction when there is one.

```ts snippet
import { BoardApiError } from '@cavuno/board';
import { suggestEmailAddress } from '@cavuno/board/email';

// On blur: 'jane@gmial.com' gives 'jane@gmail.com'; a likely-fine address gives null.
const hint = suggestEmailAddress(email);

try {
  await board.subscribe({ email, consent: true, consentText, source: 'footer' });
} catch (error) {
  if (
    error instanceof BoardApiError &&
    error.code === 'email_domain_undeliverable'
  ) {
    const { suggestion } = (error.details ?? {}) as { suggestion?: string };
    // Show "Did you mean {suggestion}?", or ask them to check the address.
  } else {
    throw error;
  }
}
```

## Errors

- `validation_bad_request` (400): a field is missing or malformed, `consent` isn't `true`, or `consentText` doesn't name the board.
- `subscribe_unknown_topic` (400): a key in `topics` isn't one of the board's live topics.
- `email_domain_undeliverable` (422): the address's domain has no mail server, usually a typo; `details.suggestion` is the corrected address when there is one.
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
