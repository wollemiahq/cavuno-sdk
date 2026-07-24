/**
 * Pure derivations for a message thread — kept out of
 * components so the fiddly bits (own-vs-counterparty, the cold-message rule,
 * the seen target) are unit-testable without a DOM. A message is "own" when
 * its author is not the counterparty (works even before the counterparty has
 * ever replied).
 */
import type { Message } from './types/me';

export function isOwnMessage(
  message: Message,
  counterpartyId: string,
): boolean {
  return message.authorBoardUserId !== counterpartyId;
}

/**
 * The cold-message rule (client-side mirror of the server gate): the viewer
 * has sent at least one message and the counterparty has not replied yet.
 * Once the counterparty sends anything, the cap lifts. The server enforces
 * the rule authoritatively (`messaging_cold_rule` 403); this mirror exists
 * so the composer can disable itself instead of surfacing the error.
 */
export function isColdRule(
  messages: Message[],
  counterpartyId: string,
): boolean {
  const theyReplied = messages.some(
    (m) => m.authorBoardUserId === counterpartyId,
  );
  const iSent = messages.some((m) => m.authorBoardUserId !== counterpartyId);
  return iSent && !theyReplied;
}

/** The id of the viewer's most recent message (the only one that shows "Seen"). */
export function lastOwnMessageId(
  messages: Message[],
  counterpartyId: string,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.authorBoardUserId !== counterpartyId) return message.id;
  }
  return null;
}
