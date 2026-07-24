import { describe, expect, it } from 'vitest';

import { companyIntro } from './company-intro';

describe('companyIntro', () => {
  it('prefers a curated summary over the description', () => {
    expect(companyIntro('We build boats.', '<p>Long story…</p>')).toBe(
      'We build boats.',
    );
  });

  it('falls back to the first sentence of the description', () => {
    expect(companyIntro(null, '<p>First sentence. Second sentence.</p>')).toBe(
      'First sentence.',
    );
  });

  it('decodes HTML entities in a description-derived intro (AT&amp;T reads AT&T)', () => {
    expect(companyIntro(null, '<p>AT&amp;T builds &#127760; things.</p>')).toBe(
      'AT&T builds 🌐 things.',
    );
  });

  it('drops <script>/<style> BODY text, not just the tags', () => {
    // The review's finding: stripping only tags would surface the JS
    // source as candidate intro copy.
    const html =
      '<style>.x{color:red}</style><script>alert(1)</script><p>Real intro.</p>';
    expect(companyIntro(null, html)).toBe('Real intro.');
  });

  it('does not crash on an out-of-range numeric entity (leaves it untouched)', () => {
    // &#9999999999; is > 0x10FFFF — String.fromCodePoint would throw.
    expect(companyIntro(null, '<p>Ref &#9999999999; stays.</p>')).toBe(
      'Ref &#9999999999; stays.',
    );
  });

  it('returns null when there is neither summary nor description', () => {
    expect(companyIntro(null, null)).toBeNull();
    expect(companyIntro('   ', null)).toBeNull();
  });
});
