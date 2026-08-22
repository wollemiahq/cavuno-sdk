/**
 * Framework-neutral `<head>` + structural JSON-LD builders for jobs-listing
 * pages. Locale-neutral pass-through: the caller supplies every
 * human-language string (title, meta description). These builders only
 * assemble the hosted STRUCTURE: meta/link descriptors, canonical, Open
 * Graph, breadcrumb + job `ItemList`.
 *
 * The SDK never decides what goes next to what. A template with two data
 * holes and a space (or `|`) between them is an English sentence with the
 * words removed — including `` `${count} ${heading} | ${boardName}` ``.
 * Pass a fully composed `title` (and `description`), same ownership.
 */
import { boardUrl, jobDetailPath } from '../paths';

import type { JsonLdObject } from './job-posting';

export interface ListingHeadOptions {
  /**
   * Fully composed document title — application owns counters, particles,
   * word order, and separators (e.g. `1,225 Jobs | Acme`, `1.225 Jobs | Acme`,
   * `1,225件の求人 | 求人ボード`). The SDK does not join count/heading/board.
   */
  title: string;
  origin: string;
  /** Absolute path of THIS page, for canonical / og:url, e.g. `/jobs/robotik`. */
  path: string;
  /**
   * Meta description — fully owned by the application. Pass a sentence from
   * the board's copy source (page config, message catalog, template). The SDK
   * does not invent or case-fold this string.
   */
  description: string;
}

/**
 * Meta/link descriptors for a jobs-listing page — caller-supplied title and
 * meta description, Open Graph, and `<link rel=canonical>`. Framework-neutral:
 * map `meta`/`links` into your head manager.
 *
 * **Why `title` and `description` are both accepted composed:** a function
 * that takes a finished description but still composes its own title from
 * count/heading/boardName is incoherent — both are display sentences whose
 * arrangement is locale-dependent (Japanese counters, RTL order, …).
 */
export function listingHead(options: ListingHeadOptions) {
  const title = options.title;
  const description = options.description;
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
 *
 * Empty / single-crumb trails omit `BreadcrumbList` (same min-2 rule as
 * `createBreadcrumbJsonLd` — an empty `itemListElement` is invalid structured
 * data). Job URLs go through `jobDetailPath` — `/jobs/{slug}` is always a
 * listing route, never a job detail; company-less jobs are dropped from the
 * ItemList rather than linked to an invalid path.
 */
export function listingJsonLd(options: {
  origin: string;
  /** Breadcrumb trail; the current (last) page omits `path` → no `item` (schema.org). */
  breadcrumbs: Array<{ name: string; path?: string }>;
  jobs?: JobLink[];
}): JsonLdObject[] {
  const objects: JsonLdObject[] = [];

  // Min-2: a trail of 0 or 1 crumbs is not a BreadcrumbList.
  if (options.breadcrumbs.length >= 2) {
    objects.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: options.breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        ...(crumb.path ? { item: boardUrl(options.origin, crumb.path) } : {}),
      })),
    });
  }

  // Only jobs with a company have a canonical detail URL
  // (`/companies/{company}/jobs/{job}`). Drop the rest — `/jobs/{slug}` is a
  // listing filter, not a job (see doctor/checks.ts JOB_DETAIL_LINK_RE).
  const detailJobs = (options.jobs ?? []).filter(
    (job): job is JobLink & { company: { slug: string } } =>
      job.company != null && Boolean(job.company.slug),
  );

  if (detailJobs.length > 0) {
    objects.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: detailJobs.map((job, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: boardUrl(
          options.origin,
          jobDetailPath(job.company.slug, job.slug),
        ),
      })),
    });
  }

  return objects;
}
