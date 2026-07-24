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
  ];

  it('iterates definitions in order, resolving option keys to current labels', () => {
    const entries = resolveCustomFieldDisplay(defs, {
      stack: 'ts',
      visa: true,
      team: 'Platform',
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
    ]);
  });

  it('keeps a false boolean but drops empty/orphan values', () => {
    const entries = resolveCustomFieldDisplay(defs, {
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
    expect(resolveCustomFieldDisplay(undefined, { visa: true })).toEqual([]);
  });
});
