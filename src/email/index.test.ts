import { describe, expect, it } from 'vitest';

import { suggestEmailAddress } from './index';

describe('suggestEmailAddress', () => {
  it.each([
    ['jane@gmial.com', 'jane@gmail.com'], // swapped pair
    ['jane@gmal.com', 'jane@gmail.com'], // dropped letter
    ['jane@gmaill.com', 'jane@gmail.com'], // extra letter
    ['jane@gmail.con', 'jane@gmail.com'], // top-level domain
    ['jane@gmail.co', 'jane@gmail.com'],
    ['jane@hotmial.co.uk', 'jane@hotmail.co.uk'],
    ['jane@yaho.com', 'jane@yahoo.com'],
    ['jane@outlok.com', 'jane@outlook.com'],
    ['jane@iclod.com', 'jane@icloud.com'],
  ])('corrects %s to %s', (typed, expected) => {
    expect(suggestEmailAddress(typed)).toBe(expected);
  });

  it('corrects only the domain, keeping the part before the @ as typed', () => {
    expect(suggestEmailAddress('  Jane.Doe+jobs@GMIAL.com ')).toBe(
      'Jane.Doe+jobs@gmail.com',
    );
    // An @ in a quoted local part stays with it.
    expect(suggestEmailAddress('"a@b"@gmial.com')).toBe('"a@b"@gmail.com');
  });

  it('leaves common domains and their country variants alone', () => {
    for (const address of [
      'jane@gmail.com',
      'jane@yahoo.ca',
      'jane@live.ca',
      'jane@hotmail.fr',
      'jane@mac.com',
      'jane@me.com',
      'jane@mail.com',
      'jane@gmx.de',
    ]) {
      expect(suggestEmailAddress(address), address).toBeNull();
    }
  });

  it('leaves domains that are more than the allowed edits away alone', () => {
    // Three edits from gmail.com.
    expect(suggestEmailAddress('jane@gamil.org')).toBeNull();
    expect(suggestEmailAddress('jane@acme.co')).toBeNull();
    expect(suggestEmailAddress('jane@cavuno.com')).toBeNull();
    // Short names get only their top-level domain fixed.
    expect(suggestEmailAddress('jane@aws.com')).toBeNull();
    expect(suggestEmailAddress('jane@aol.co')).toBe('jane@aol.com');
  });

  it('leaves real domains that look like a provider alone', () => {
    for (const domain of [
      'ey.com', // hey.com
      'nike.com', // live.com
      'key.com', // hey.com
      'ge.com', // me.com
      'aon.com', // aol.com
      'zoom.com', // zoho.com
      'cloud.com', // icloud.com
      'email.com', // gmail.com
      'foxmail.com', // hotmail.com
      'online.de', // t-online.de
      'fastmail.fm', // fastmail.com
      'op.pl', // wp.pl
      'yahoo.co.id', // yahoo.co.in
      'yahoo.com.hk', // yahoo.co.uk
      'outlook.sa', // outlook.fr
    ]) {
      expect(suggestEmailAddress(`jane@${domain}`), domain).toBeNull();
    }
  });

  it('keeps a real top-level domain the person typed', () => {
    // Real providers two edits from a listed one with another country's TLD.
    expect(suggestEmailAddress('jane@mail.de')).toBeNull();
    expect(suggestEmailAddress('jane@outlook.jp')).toBeNull();
    expect(suggestEmailAddress('jane@yahoo.com.mx')).toBeNull();
    // A typo inside the name still gets corrected under the same TLD.
    expect(suggestEmailAddress('jane@hotmial.de')).toBe('jane@hotmail.de');
    expect(suggestEmailAddress('jane@gmial.de')).toBeNull();
  });

  it('prefers the closest domain, then the more common one', () => {
    // One edit from both hotmail.com and hotmail.ca: the more common wins.
    expect(suggestEmailAddress('jane@hotmail.cm')).toBe('jane@hotmail.com');
    // One edit from both live.com and live.ca: the earlier one wins.
    expect(suggestEmailAddress('jane@live.cam')).toBe('jane@live.com');
  });

  it('answers null for anything that is not local@domain', () => {
    for (const value of [
      '',
      'jane',
      '@gmial.com',
      'jane@',
      'jane@gmial',
      'jane@localhost',
    ]) {
      expect(suggestEmailAddress(value), value).toBeNull();
    }
  });
});
