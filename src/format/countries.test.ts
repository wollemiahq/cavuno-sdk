import { describe, expect, it } from 'vitest';

import { COUNTRY_CODES, countryOptions } from './countries';

describe('COUNTRY_CODES', () => {
  it('ships the complete supported country set', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(COUNTRY_CODES).toContain('XK');
    expect(COUNTRY_CODES).not.toContain('KP');
  });
});

describe('countryOptions', () => {
  it('labels and sorts the full set in the board language', () => {
    const options = countryOptions('de');

    expect(options).toHaveLength(COUNTRY_CODES.length);
    expect(options.find((option) => option.code === 'DE')?.name).toBe(
      'Deutschland',
    );
    const names = options.map((option) => option.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('de').compare));
  });

  it('resolves the user-assigned Kosovo code', () => {
    expect(countryOptions('en').find((option) => option.code === 'XK')?.name)
      .not.toHaveLength(2);
  });

  it('degrades to bare codes instead of throwing on an unresolvable language', () => {
    expect(countryOptions('not a locale')).toHaveLength(COUNTRY_CODES.length);
  });
});
