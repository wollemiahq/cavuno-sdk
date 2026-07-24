import { locationLabel } from './location';

import type { PublicJob, PublicJobCard } from '../types/jobs';

/**
 * Adapt a full `PublicJob` (e.g. an embedded saved job) to the slim
 * `PublicJobCard` shape a list card renders — computing the card's
 * pre-resolved `locationLabel`/`remoteLocationLabel` from the full job's
 * fields. Board language is required because the computed location label is
 * display text.
 */
export function fullJobToCard(locale: string, job: PublicJob): PublicJobCard {
  return {
    id: job.id,
    object: 'job_card',
    slug: job.slug ?? '',
    title: job.title,
    publishedAt: job.publishedAt,
    employmentType: job.employmentType,
    remoteOption: job.remoteOption,
    remoteLocationLabel: job.remoteWorldwide ? 'Worldwide' : null,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryTimeframe: job.salaryTimeframe,
    isFeatured: job.isFeatured,
    locationLabel: locationLabel(locale, job),
    company: job.company?.slug
      ? {
          slug: job.company.slug,
          name: job.company.name ?? '',
          logoUrl: job.company.logoUrl,
        }
      : null,
    categories: job.categories,
    skills: job.skills,
    links: job.links,
  };
}
