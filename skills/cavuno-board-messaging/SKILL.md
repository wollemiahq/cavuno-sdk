---
name: cavuno-board-messaging
description: Polled messaging contract with @cavuno/board. Use for inboxes, unread badges, threads, read receipts, message moderation, or user blocks.
---

# Polled messaging contract

Messaging is authenticated employer-to-candidate REST. Near-live behavior comes from polling at a 3–5 second cadence while the page is visible. `list`, `listMessages`, and `unreadCount` are the transport; the SDK exposes no realtime subscription.

## Keep the poll visible

Refresh immediately on start or return to the tab, and maintain at most one timer.

```ts snippet
const pollMs = 4000;

async function refreshInbox() {
  const [{ count }, inbox] = await Promise.all([
    board.me.conversations.unreadCount(),
    board.me.conversations.list({ limit: 20 }),
  ]);
  renderInbox(count, inbox.data);
}

let timer: ReturnType<typeof setInterval> | undefined;
function startPolling() {
  void refreshInbox();
  timer ??= setInterval(refreshInbox, pollMs);
}
function stopPolling() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') startPolling();
  else stopPolling();
});
startPolling();
```

Inbox rows include `lastMessageAt`, `lastMessageSnippet`, `hasUnread`, and the live-resolved `counterparty` with `displayName`, `avatarUrl`, `companyName`, and `handle`. `list({ archived: true })` reads the archived view; `archive` and `unarchive` are idempotent and per-side.

## Render a thread faithfully

Header and messages are separate reads. Messages arrive oldest-first. An unsent message is a tombstone with empty `body` and non-null `deletedAt`; preserve its position with a placeholder.

```ts snippet
const conversation = await board.me.conversations.retrieve(conversationId);
const { data: messages } = await board.me.conversations.listMessages(
  conversationId,
  { limit: 50 });

conversation.viewerRole;
conversation.viewerLastReadMessageId;

for (const message of messages) {
  message.body;
  message.deletedAt;
  message.readAt;
  message.editedAt;
}

await board.me.conversations.markRead(conversationId);
```

Call `markRead` when the viewer opens the thread. It clears their unread state and advances read receipts for the counterparty.

## Send

`findExisting` routes to an existing thread. Employer-only `start` cold-initiates a candidate; `startAboutApplication` begins in application context; `reply` continues a thread. Each send returns a `Message`.

```ts snippet
const existing = await board.me.conversations.findExisting({
  candidateBoardUserId,
});

const first = await board.me.conversations.start({
  candidateBoardUserId,
  body: 'Hi — your profile looks like a great fit.',
});
await board.me.conversations.reply(first.conversationId, {
  body: 'Following up!',
});
```

The server enforces messaging enablement, cold-message rules, pair limits, and blocks. Handle `messaging_*` `BoardApiError` codes with `cavuno-board-errors`.

## Edit, moderate, and block

Own-message edits and unsends have a 15-minute window. Unsend is idempotent and creates a tombstone. Reporting a message addressed to the viewer automatically blocks its author.

```ts snippet
await board.me.messages.edit(messageId, { body: 'Fixed typo' });
await board.me.messages.unsend(messageId);

const report = await board.me.messages.report(messageId, {
  reason: 'spam',
});

await board.me.blocks.create({ boardUserId });
const blocked = await board.me.blocks.status(boardUserId);
await board.me.blocks.remove(boardUserId);
```

Report reasons are `'spam' | 'harassment' | 'misrepresentation' | 'other'`. `board.me.blocks.list()` enumerates blocks.

## Completion gate

- Hiding the tab stops the timer; returning starts one timer and refreshes immediately.
- A second account's message updates `unreadCount().count` and `hasUnread` within one interval.
- Opening a thread calls `markRead`; the sender later sees `readAt`.
- Unsend renders a tombstone in place.
- Messaging policy errors produce deliberate UI states rather than a generic success path.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
