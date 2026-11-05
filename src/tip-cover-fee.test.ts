import { describe, expect, it } from 'vitest';

import { tipCoverFeeCents } from './tip-cover-fee';

const USD = { percentBps: 290, fixedMinor: 30 };

describe('tipCoverFeeCents', () => {
  it('grosses the tip up by the card rate', () => {
    // 530 / 0.971 = 545.83 → a charge of 546, a fee of 46.
    expect(tipCoverFeeCents(500, USD)).toBe(46);
    // 1264 / 0.971 = 1301.75 → 1302, a fee of 68.
    expect(tipCoverFeeCents(1234, USD)).toBe(68);
    // Zero-decimal style rate: 1000 / 0.964 = 1037.34 → 1038, a fee of 38.
    expect(tipCoverFeeCents(1000, { percentBps: 360, fixedMinor: 0 })).toBe(38);
  });

  it('is 0 when the board does not offer it or the amount is not a tip', () => {
    expect(tipCoverFeeCents(500, null)).toBe(0);
    expect(tipCoverFeeCents(0, USD)).toBe(0);
    expect(tipCoverFeeCents(12.5, USD)).toBe(0);
  });
});
