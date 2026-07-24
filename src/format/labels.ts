import { getSalaryLexicon } from './salary-lexicon';

import type { SeniorityKey } from './salary-lexicon';
import type { BoardLabelOverrides } from './ui-copy';

/**
 * Enum-value → display-label helpers, in the BOARD language (required
 * leading parameter).
 *
 * Seniority labels localize via the salary lexicon (en+de); employment and
 * remote labels carry native de/fr catalog vocabularies ( — a
 * recorded parity-EXCEED: the hosted board renders these English unless an
 * operator overrides them). Stored operator overrides — the hosted
 * `jobCardLabels` keys (`fullTimeLabel`, `seniorityExecutive`, …) — apply on
 * top via the optional `labels` bag (`board.context().labels`).
 */

// English source vocabulary — mirrors `public/locales/en/boards.json` `jobs.*`.
const EN_LABELS: Record<string, string> = {
  // remoteOption
  on_site: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  // employmentType
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
  volunteer: 'Volunteer',
  other: 'Other',
};

// German — transcribed from startup-insider's stored overrides.
const DE_LABELS: Record<string, string> = {
  on_site: 'Vor Ort',
  hybrid: 'Hybrid',
  remote: 'Remote',
  full_time: 'Vollzeit',
  part_time: 'Teilzeit',
  contract: 'Freiberuflich',
  internship: 'Praktikum',
  temporary: 'Befristet',
  volunteer: 'Ehrenamtlich',
  other: 'Sonstiges',
};

// French — fresh set, the abstraction-prover.
const FR_LABELS: Record<string, string> = {
  on_site: 'Sur site',
  hybrid: 'Hybride',
  remote: 'Télétravail',
  full_time: 'Temps plein',
  part_time: 'Temps partiel',
  contract: 'Contrat',
  internship: 'Stage',
  temporary: 'Temporaire',
  volunteer: 'Bénévolat',
  other: 'Autre',
};

const VOCABULARIES: Record<string, Record<string, string>> = {
  en: EN_LABELS,
  de: DE_LABELS,
  fr: FR_LABELS,
};

/** Wire enum value → the hosted `jobCardLabels` override key for it. */
const OVERRIDE_KEYS: Record<string, string> = {
  on_site: 'onSiteLabel',
  hybrid: 'hybridLabel',
  remote: 'remoteLabel',
  full_time: 'fullTimeLabel',
  part_time: 'partTimeLabel',
  contract: 'contractLabel',
  internship: 'internshipLabel',
  temporary: 'temporaryLabel',
  volunteer: 'volunteerLabel',
  entry_level: 'seniorityEntryLevel',
  associate: 'seniorityAssociate',
  mid_level: 'seniorityMidLevel',
  senior: 'senioritySenior',
  lead: 'seniorityLead',
  principal: 'seniorityPrincipal',
  director: 'seniorityDirector',
  executive: 'seniorityExecutive',
};

const SENIORITY_KEYS: ReadonlySet<string> = new Set([
  'entry_level',
  'associate',
  'mid_level',
  'senior',
  'lead',
  'principal',
  'director',
  'executive',
]);

function storedOverride(
  value: string,
  labels: BoardLabelOverrides | undefined,
): string | null {
  const key = OVERRIDE_KEYS[value];
  const override = key ? labels?.jobCardLabels?.[key] : undefined;
  return typeof override === 'string' && override.trim() !== ''
    ? override
    : null;
}

/**
 * Display label for a job enum value (`remoteOption`, `employmentType`,
 * `seniority`) in the board language, ⊕ the board's stored operator
 * overrides when the `labels` bag is passed. Unknown values pass through
 * unchanged (enums grow additively within v1); unseeded languages fall back
 * to the English source vocabulary.
 *
 * @example
 * fieldLabel('en', 'mid_level'); // "Mid-level"
 * fieldLabel('de', 'executive'); // "Führungskraft"
 * fieldLabel('de', 'full_time'); // "Vollzeit"
 * fieldLabel('de', 'full_time', board.labels); // operator override when set
 */
export function fieldLabel(
  locale: string,
  value: string | null,
  labels?: BoardLabelOverrides,
): string | null {
  if (!value) return null;
  const override = storedOverride(value, labels);
  if (override) return override;
  if (SENIORITY_KEYS.has(value)) {
    return getSalaryLexicon(locale).seniority[value as SeniorityKey];
  }
  const vocabulary = VOCABULARIES[locale] ?? EN_LABELS;
  return vocabulary[value] ?? EN_LABELS[value] ?? value;
}
