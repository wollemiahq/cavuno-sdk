---
name: cavuno-board-messaging
description: Build the board-user messaging inbox with the @cavuno/board SDK — me.conversations (list, unreadCount, retrieve, listMessages, start, reply, markRead, archive), me.messages (edit, unsend, report), me.blocks. Covers the polled-REST contract (no realtime transport in v1), visibility-aware polling, the unread badge, and read receipts.
---

# Messaging: the polled inbox

Employer↔candidate direct messaging for signed-in board users. The v1 transport is **polled REST by design** — there is no realtime primitive; near-live UX comes from re-fetching on an interval (3–5s is the reference cadence).

Out of scope — do not invent exports: no websockets, no SSE, no `subscribe`/`onMessage` — polling `list` / `listMessages` / `unreadCount` IS the contract.

## When to use

- The inbox page, unread badge, thread view, and composer.
- Edit/unsend, report-a-message, and block flows.

## When not to use

- Anonymous visitors — every method here requires a signed-in board user (see `cavuno-board-auth`).
- Job applications themselves — messaging an applicant *starts from* an application, but the application surface is `board.me.applications.*`.

## Poll while visible

Poll only while the tab is visible — stop on hide, resume (with an immediate refresh) on show:

```ts snippet
const POLL_MS = 4000; // 3–5s reference cadence

async function refresh() {
  const [{ count }, inbox] = await Promise.all([
    board.me.conversations.unreadCount(), // distinct unread threads → badge
    board.me.conversations.list({ limit: 20 }),
  ]);
  render(count, inbox.data);
}

let timer: ReturnType<typeof setInterval> | undefined;
function start() {
  void refresh();
  timer ??= setInterval(refresh, POLL_MS);
}
function stop() {
  clearInterval(timer);
  timer = undefined;
}
document.addEventListener('visibilitychange', () => {
  document.visibilityState === 'visible' ? start() : stop();
});
start();
```

Each inbox row is a `Conversation`: `lastMessageAt`, `lastMessageSnippet`, `hasUnread`, and a live-resolved `counterparty` (`displayName`, `avatarUrl`, `companyName`, `handle`). `list({ archived: true })` is the archived view; `archive`/`unarchive` move a thread per-side and are idempotent.

## The thread: header, messages, read receipts

The header and the messages are separate calls. Messages come oldest-first; unsent messages are tombstones (empty `body`, `deletedAt` set) — render a placeholder, don't filter them out.

```ts snippet
const convo = await board.me.conversations.retrieve(conversationId);
convo.viewerRole;              // 'employer' | 'candidate'
convo.viewerLastReadMessageId; // my last-read pointer (null = never)

const { data: messages } = await board.me.conversations.listMessages(
  conversationId,
  { limit: 50 });
for (const m of messages) {
  m.body;     // '' when unsent (tombstone)
  m.readAt;   // read receipt — when the recipient read it, or null
  m.editedAt; // non-null after an edit
}

await board.me.conversations.markRead(conversationId); // idempotent
```

Call `markRead` when the viewer opens the thread — it clears `hasUnread` and drives the counterparty's `readAt` receipts.

## Sending

`start` cold-initiates a candidate (employer-only) and converges on the existing thread; `startAboutApplication` messages an applicant in application context; `reply` continues a thread. Each returns the created `Message`.

```ts snippet
// Route to an existing thread instead of opening a composer:
const { conversationId } = await board.me.conversations.findExisting({
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

Sends are gated server-side (messaging enabled, cold-message rule, per-pair daily limits, blocks) — failures arrive as `messaging_*` `BoardApiError` codes; branch with the guards from `cavuno-board-errors`.

## Edit, unsend, report, block

Your own messages can be edited or unsent within a 15-minute window. Reporting a message addressed to you auto-blocks its author.

```ts snippet
await board.me.messages.edit(messageId, { body: 'fixed typo' });
await board.me.messages.unsend(messageId); // tombstones; idempotent

const { blocked } = await board.me.messages.report(messageId, {
  reason: 'spam', // 'spam' | 'harassment' | 'misrepresentation' | 'other'
});

await board.me.blocks.create({ boardUserId }); // silent; idempotent
```

`board.me.blocks.list()` / `.remove(boardUserId)` / `.status(boardUserId)` round out blocking.

## Verify

- [ ] Kill the network tab timer: polling stops when the tab is hidden, resumes on focus with a fresh read.
- [ ] Send from a second account: the badge (`unreadCount().count`) and `hasUnread` flip within one poll interval.
- [ ] Open the thread: `markRead` fires once and the sender sees `readAt` populate on their next poll.
- [ ] Unsend a message: it renders as a tombstone (empty `body`), not a gap.
