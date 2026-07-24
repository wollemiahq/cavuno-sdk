import { describe, expect, it } from 'vitest';

import { isColdRule, isOwnMessage, lastOwnMessageId } from './messaging-derive';

import type { Message } from './types/me';

const COUNTERPARTY = 'bu_them';
const ME = 'bu_me';

function msg(id: string, author: string): Message {
  return {
    id,
    object: 'message',
    conversationId: 'c1',
    authorBoardUserId: author,
    recipientBoardUserId: author === ME ? COUNTERPARTY : ME,
    body: `body ${id}`,
    author: { displayName: 'X', avatarUrl: null, companyName: null },
    sentAt: '2026-07-01T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    readAt: null,
  };
}

describe('isOwnMessage', () => {
  it('treats a message the counterparty did NOT author as the viewer’s own', () => {
    // This is the whole basis of bubble alignment + which actions show; if it
    // inverted, the viewer would see edit/unsend on the recruiter's messages.
    expect(isOwnMessage(msg('m1', ME), COUNTERPARTY)).toBe(true);
    expect(isOwnMessage(msg('m2', COUNTERPARTY), COUNTERPARTY)).toBe(false);
  });
});

describe('isColdRule', () => {
  it('is active once the viewer has sent but the counterparty has not replied', () => {
    expect(isColdRule([msg('m1', ME)], COUNTERPARTY)).toBe(true);
  });

  it('lifts the moment the counterparty replies (the rule exists to gate spam, not conversation)', () => {
    expect(
      isColdRule([msg('m1', ME), msg('m2', COUNTERPARTY)], COUNTERPARTY),
    ).toBe(false);
  });

  it('is inactive when the counterparty opened the thread (viewer can always reply)', () => {
    expect(isColdRule([msg('m1', COUNTERPARTY)], COUNTERPARTY)).toBe(false);
  });

  it('is inactive on an empty thread', () => {
    expect(isColdRule([], COUNTERPARTY)).toBe(false);
  });
});

describe('lastOwnMessageId', () => {
  it('returns only the viewer’s most recent message id (the sole "Seen" target)', () => {
    const messages = [
      msg('m1', ME),
      msg('m2', COUNTERPARTY),
      msg('m3', ME),
      msg('m4', COUNTERPARTY),
    ];
    expect(lastOwnMessageId(messages, COUNTERPARTY)).toBe('m3');
  });

  it('returns null when the viewer has sent nothing', () => {
    expect(
      lastOwnMessageId([msg('m1', COUNTERPARTY)], COUNTERPARTY),
    ).toBeNull();
  });
});
