import type { CustomFieldDefinition } from '../types/board';
import type { CustomFieldValues } from '../types/jobs';

/**
 * Resolve a job's opaque `customFieldValues` into ordered, display-ready
 * entries for the "Additional details" section, matching the hosted board's
 * display behavior. Pure. Iterates the *definitions* (from board
 * context) in config order, so display order is operator-controlled, orphan
 * values (deleted definitions) are never inspected, and empty values drop per
 * field. Select values resolve their stored option KEY to the current label
 * (rename-safe); an option with no current match is dropped. Booleans and
 * numbers stay raw (discriminated `kind`) — the render layer formats them
 * with the board locale (`Intl.NumberFormat`, Yes/No chrome). Pre-stringifying
 * numbers would ship `kind: 'text'` and foreclose locale-aware formatting.
 *
 * Multi-select stays an array of resolved labels (`kind: 'multi_select'`).
 * Pre-joining with `Intl.ListFormat` would ship `kind: 'text'` and foreclose
 * locale-aware **list** formatting (short style, disjunction, separate chips)
 * for the same reason numbers must not be pre-stringified. The application
 * joins when it wants a sentence:
 * `new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(values)`.
 *
 * `language` remains the required leading parameter ( call-site
 * pattern / signature stability). It is not read here — multi-select no
 * longer joins in the SDK — but callers already pass `board.context().language`
 * and removing it would be a delete from the published surface.
 */
export type CustomFieldDisplayEntry =
  | { key: string; label: string; kind: 'text'; value: string }
  | { key: string; label: string; kind: 'boolean'; value: boolean }
  | { key: string; label: string; kind: 'number'; value: number }
  | { key: string; label: string; kind: 'multi_select'; values: string[] };

function resolveMultiSelectLabels(
  def: CustomFieldDefinition,
  raw: unknown,
): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const labels = raw
    .map((key) => def.options?.find((o) => o.key === key)?.label)
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels : null;
}

function renderTextValue(
  def: CustomFieldDefinition,
  raw: unknown,
): string | null {
  switch (def.type) {
    case 'number':
      // Numbers are handled as `kind: 'number'` in the main loop — never here.
      return null;
    case 'multi_select':
      // Multi-select is handled as `kind: 'multi_select'` — never joined here.
      return null;
    case 'single_select': {
      if (typeof raw !== 'string') return null;
      return def.options?.find((o) => o.key === raw)?.label ?? null;
    }
    default:
      // short_text / long_text — free text, shown as-is when non-blank.
      return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  }
}

export function resolveCustomFieldDisplay(
  language: string,
  definitions: CustomFieldDefinition[] | undefined,
  values: CustomFieldValues | undefined,
): CustomFieldDisplayEntry[] {
  // Signature-stable. Not consumed: multi-select
  // returns labels; the app owns ListFormat / chips / short style.
  void language;

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

    if (def.type === 'number') {
      // Raw number — app formats with Intl.NumberFormat(boardLanguage).
      // String(raw) would freeze en-style digits and ship as opaque text.
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        entries.push({
          key: def.key,
          label: def.label,
          kind: 'number',
          value: raw,
        });
      }
      continue;
    }

    if (def.type === 'multi_select') {
      // Labels stay an array — app joins (ListFormat) or renders chips.
      // Joining here would make short/disjunction/chip layouts unrecoverable.
      const labels = resolveMultiSelectLabels(def, raw);
      if (labels) {
        entries.push({
          key: def.key,
          label: def.label,
          kind: 'multi_select',
          values: labels,
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
