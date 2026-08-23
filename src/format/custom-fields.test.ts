import { describe, expect, it } from 'vitest';

import { resolveCustomFieldDisplay } from './custom-fields';

import type { CustomFieldDefinition } from '../types/board';

describe('resolveCustomFieldDisplay', () => {
  const defs: CustomFieldDefinition[] = [
    {
      key: 'visa',
      label: 'Visa sponsorship',
      type: 'boolean',
      required: false,
    },
    {
      key: 'stack',
      label: 'Primary stack',
      type: 'single_select',
      required: false,
      options: [
        { key: 'ts', label: 'TypeScript' },
        { key: 'go', label: 'Go' },
      ],
    },
    { key: 'team', label: 'Team', type: 'short_text', required: false },
    {
      key: 'headcount',
      label: 'Team size',
      type: 'number',
      required: false,
    },
    {
      key: 'perks',
      label: 'Perks',
      type: 'multi_select',
      required: false,
      options: [
        { key: 'health', label: 'Health' },
        { key: 'dental', label: 'Dental' },
        { key: 'gym', label: 'Gym' },
      ],
    },
  ];

  it('iterates definitions in order, resolving option keys to current labels', () => {
    const entries = resolveCustomFieldDisplay('en', defs, {
      stack: 'ts',
      visa: true,
      team: 'Platform',
      headcount: 12,
    });
    expect(entries).toEqual([
      { key: 'visa', label: 'Visa sponsorship', kind: 'boolean', value: true },
      {
        key: 'stack',
        label: 'Primary stack',
        kind: 'text',
        value: 'TypeScript',
      },
      { key: 'team', label: 'Team', kind: 'text', value: 'Platform' },
      { key: 'headcount', label: 'Team size', kind: 'number', value: 12 },
    ]);
  });

  it('emits kind number with the raw value (not pre-stringified text)', () => {
    const entries = resolveCustomFieldDisplay('de', defs, {
      headcount: 1_234_567.5,
    });
    expect(entries).toEqual([
      {
        key: 'headcount',
        label: 'Team size',
        kind: 'number',
        value: 1_234_567.5,
      },
    ]);
    // Consumer can still format with the board locale.
    expect(
      new Intl.NumberFormat('de').format(
        (entries[0] as { kind: 'number'; value: number }).value,
      ),
    ).toMatch(/1\.234\.567/);
  });

  it('keeps a false boolean but drops empty/orphan values', () => {
    const entries = resolveCustomFieldDisplay('en', defs, {
      visa: false,
      stack: 'deleted-option',
      team: '',
    });
    // visa:false is a real answer; the orphan select key and blank text drop.
    expect(entries).toEqual([
      { key: 'visa', label: 'Visa sponsorship', kind: 'boolean', value: false },
    ]);
  });

  it('is empty when there are no definitions', () => {
    expect(resolveCustomFieldDisplay('en', undefined, { visa: true })).toEqual(
      [],
    );
  });

  it('returns multi-select labels as an array (app owns ListFormat / chips)', () => {
    const en = resolveCustomFieldDisplay('en', defs, {
      perks: ['health', 'dental', 'gym'],
    });
    expect(en).toEqual([
      {
        key: 'perks',
        label: 'Perks',
        kind: 'multi_select',
        values: ['Health', 'Dental', 'Gym'],
      },
    ]);

    // App can still join when it wants a sentence — and can pick style/type.
    expect(
      new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
        (en[0] as { kind: 'multi_select'; values: string[] }).values,
      ),
    ).toBe('Health, Dental, and Gym');
    expect(
      new Intl.ListFormat('de', { style: 'long', type: 'conjunction' }).format(
        (en[0] as { kind: 'multi_select'; values: string[] }).values,
      ),
    ).toBe('Health, Dental und Gym');
  });

  it('keeps multi-select labels recoverable regardless of locale tag', () => {
    // Labels are data; no locale join happens in the SDK, so invalid tags
    // no longer drop the field (they used to when ListFormat failed).
    const ja = resolveCustomFieldDisplay('ja_JP', defs, {
      perks: ['health', 'dental'],
    });
    expect(ja[0]).toEqual({
      key: 'perks',
      label: 'Perks',
      kind: 'multi_select',
      values: ['Health', 'Dental'],
    });

    const bad = resolveCustomFieldDisplay('xx-BAD-!!', defs, {
      perks: ['health', 'dental', 'gym'],
    });
    expect(bad[0]).toEqual({
      key: 'perks',
      label: 'Perks',
      kind: 'multi_select',
      values: ['Health', 'Dental', 'Gym'],
    });
  });

  it('drops multi-select when every option key is orphaned', () => {
    expect(
      resolveCustomFieldDisplay('en', defs, {
        perks: ['gone', 'also-gone'],
      }),
    ).toEqual([]);
  });
});
