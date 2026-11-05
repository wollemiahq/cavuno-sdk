import type { TipJar } from './types/tip-jar';

/**
 * The card fee a tipper adds on top of a tip of `amountCents` when they tick
 * "Add {fee} to cover the card fee": the same number the checkout charges
 * for `coverFee: true`. Pass the tip jar's `coverFee` rate; 0 when it is
 * `null` (the board does not offer it) or the amount is not a whole positive
 * number.
 *
 * The fee is ceil((amount + fixedMinor) / (1 - percentBps / 10000)) - amount,
 * worked in whole numbers, so the board keeps the whole tip after the card
 * fee.
 *
 * @example
 * const jar = await board.tipJar.get();
 * const fee = tipCoverFeeCents(500, jar.coverFee); // 46 at 2.9% + 30
 */
export function tipCoverFeeCents(
  amountCents: number,
  coverFee: TipJar['coverFee'],
): number {
  if (!coverFee || !Number.isInteger(amountCents) || amountCents <= 0) {
    return 0;
  }
  const keepBps = 10_000 - coverFee.percentBps;
  const numerator = (amountCents + coverFee.fixedMinor) * 10_000;
  return Math.floor((numerator + keepBps - 1) / keepBps) - amountCents;
}
