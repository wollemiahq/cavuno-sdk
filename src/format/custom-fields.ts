import type { CustomFieldDefinition } from '../types/board';
import type { CustomFieldValues } from '../types/jobs';

/**
 * Resolve a job's opaque `customFieldValues` into ordered, display-ready
 * entries for the "Additional details" section, matching the hosted board's
 * display behavior. Pure. Iterates the *definitions* (from board
 * context) in config order, so display order is operator-controlled, orphan
 * values (deleted definitions) are never inspected, and empty values drop per
 * field. Select values resolve their stored option KEY to the current label
 * (rename-safe); an option with no current match is dropped. Booleans stay raw
 * (a discriminated `kind`) — the render layer authors the "Yes"/"No" chrome
 * (English; localized copy is the use-intl future release).
 */
export type CustomFieldDisplayEntry =
  | { key: string; label: string; kind: 'text'; value: string }
  | { key: string; label: string; kind: 'boolean'; value: boolean };

function renderTextValue(
  def: CustomFieldDefinition,
  raw: unknown,
): string | null {
  switch (def.type) {
    case 'number':
      return typeof raw === 'number' ? String(raw) : null;
    case 'single_select': {
      if (typeof raw !== 'string') return null;
      return def.options?.find((o) => o.key === raw)?.label ?? null;
    }
    case 'multi_select': {
      if (!Array.isArray(raw) || raw.length === 0) return null;
      const labels = raw
        .map((key) => def.options?.find((o) => o.key === key)?.label)
        .filter((label): label is string => Boolean(label));
      return labels.length > 0 ? labels.join(', ') : null;
    }
    default:
      // short_text / long_text — free text, shown as-is when non-blank.
      return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  }
}

export function resolveCustomFieldDisplay(
  definitions: CustomFieldDefinition[] | undefined,
  values: CustomFieldValues | undefined,
): CustomFieldDisplayEntry[] {
  const entries: CustomFieldDisplayEntry[] = [];

  for (const def of definitions ?? []) {
    const raw = values?.[def.key];

    if (def.type === 'boolean') {
      // false is a real answer — only an absent/non-boolean value is skipped.
      if (typeof raw === 'boolean') {
        entries.push({
          key: def.key,
          label: def.label,
          kind: 'boolean',
          value: raw,
        });
      }
      continue;
    }

    const value = renderTextValue(def, raw);
    if (value !== null) {
      entries.push({ key: def.key, label: def.label, kind: 'text', value });
    }
  }

  return entries;
}
