import { fieldLabel } from './labels';

import type { PublicJob, PublicJobCard } from '../types/jobs';

/**
 * Location display labels for job cards and detail pages, in the board
 * language. The wrapper words
 * ("Remote", "(hybrid)", "Worldwide") follow the hosted board's current
 * English-only rendering; place names arrive already board-language from the
 * wire (the API serves canonical, localized labels).
 */

/**
 * Location label for the full `PublicJob` (detail pages, embedded saved
 * jobs): first office location's display name, remote/hybrid wrapping per
 * `remoteOption`.
 */
export function locationLabel(locale: string, job: PublicJob): string {
  const office = job.officeLocations[0];
  const place = office
    ? (office.displayName ??
      [office.city ?? office.locality, office.country]
        .filter(Boolean)
        .join(', '))
    : null;

  if (job.remoteOption === 'remote') {
    return job.remoteWorldwide ? 'Remote (worldwide)' : 'Remote';
  }
  if (!place) return fieldLabel(locale, job.remoteOption) ?? '';
  return job.remoteOption === 'hybrid' ? `${place} (hybrid)` : place;
}

/**
 * Location label for a list CARD. The card read-model pre-computes
 * `locationLabel` and (for remote jobs) `remoteLocationLabel` server-side —
 * the slim card carries no `officeLocations`/`remoteWorldwide` — so those
 * wire fields are used directly, matching what the hosted card renders.
 */
export function cardLocationLabel(
  locale: string,
  job: Pick<
    PublicJobCard,
    'remoteOption' | 'remoteLocationLabel' | 'locationLabel'
  >,
): string {
  if (job.remoteOption === 'remote') {
    return job.remoteLocationLabel
      ? `Remote · ${job.remoteLocationLabel}`
      : 'Remote';
  }
  return job.locationLabel ?? fieldLabel(locale, job.remoteOption) ?? '';
}
