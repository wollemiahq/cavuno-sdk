/**
 * Framework-neutral `<head>` + structural JSON-LD builders for jobs-listing
 * pages. Locale-neutral pass-through: the caller supplies the
 * heading/board copy (title/description COPY is board-SEO-config +
 * localized — a named exclusion; these builders replicate the hosted
 * STRUCTURE: title with result count, canonical, Open Graph, breadcrumb +
 * job `ItemList`).
 */
import type { JsonLdObject } from './job-posting';

export interface ListingHeadOptions {
  boardName: string;
  origin: string;
  /** Absolute path of THIS page, for canonical / og:url, e.g. `/jobs/robotik`. */
  path: string;
  /** Human heading, e.g. `Robotik jobs in Berlin` or `Jobs`. */
  heading: string;
  /** Result count — prefixed into the title (`N heading`). */
  count?: number;
}

/**
 * Meta/link descriptors for a jobs-listing page — title (with result
 * count), meta description, Open Graph, and `<link rel=canonical>`.
 * Framework-neutral: map `meta`/`links` into your head manager.
 */
export function listingHead(options: ListingHeadOptions) {
  const countPrefix =
    typeof options.count === 'number' ? `${options.count} ` : '';
  const title = `${countPrefix}${options.heading} | ${options.boardName}`;
  const description = `Browse ${countPrefix}${options.heading.toLowerCase()} on ${options.boardName}.`;
  const url = `${options.origin}${options.path}`;

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }],
  };
}

interface JobLink {
  slug: string;
  company: { slug: string } | null;
}

/**
 * `BreadcrumbList` (+ `ItemList` of the visible jobs) JSON-LD for a listing
 * page, mirroring the structural JSON-LD the hosted board emits. The rich
 * category set (`Occupation`/`FAQPage`/`MonetaryAmountDistribution`) lives
 * in `./salary` — feed it the salary detail reads.
 */
export function listingJsonLd(options: {
  origin: string;
  /** Breadcrumb trail; the current (last) page omits `path` → no `item` (schema.org). */
  breadcrumbs: Array<{ name: string; path?: string }>;
  jobs?: JobLink[];
}): JsonLdObject[] {
  const jobUrl = (job: JobLink) =>
    job.company
      ? `${options.origin}/companies/${job.company.slug}/jobs/${job.slug}`
      : `${options.origin}/jobs/${job.slug}`;

  const objects: JsonLdObject[] = [
    {
      '@context': 'https://schema.org',
      // Deliberately NOT createBreadcrumbJsonLd (breadcrumbs.ts): listing trails
      // are code-constructed (never user copy), so the hosted listing page skips
      // the trim/drop-blank/min-2 gate that module transcribes. Same schema.org
      // fragment, different (intentional) semantics — do not unify blindly.
      '@type': 'BreadcrumbList',
      itemListElement: options.breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        ...(crumb.path ? { item: `${options.origin}${crumb.path}` } : {}),
      })),
    },
  ];

  if (options.jobs && options.jobs.length > 0) {
    objects.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: options.jobs.map((job, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: jobUrl(job),
      })),
    });
  }

  return objects;
}
