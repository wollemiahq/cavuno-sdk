/**
 * `BreadcrumbList` structured data, transcribed from the hosted board's
 * the hosted board implementation (`createBreadcrumbListJsonLd`)
 * and tested against the hosted behavior.
 *
 * The hosted builder resolves relative hrefs against the board's canonical
 * origin (custom domain aware, db-backed); this transcription takes the
 * origin as a plain argument instead — pass absolute hrefs, or provide
 * `options.origin` for relative ones. JSON-LD structure is locale-neutral:
 * the labels are caller copy passed through.
 */
import {
  BOARD_PATHS,
  jobsCategoryPath,
  jobsLocationCategoryPath,
  jobsLocationPath,
} from '../paths';

import type { PublicJob } from '../types/jobs';
import type { JsonLdObject } from './job-posting';

export interface BreadcrumbItemInput {
  label: string | null | undefined;
  href?: string | null;
}

/**
 * Build a `BreadcrumbList`, hosted semantics: labels are trimmed and empty
 * items dropped; fewer than 2 surviving items → `null` (a single crumb is
 * not a trail); the current page (no `href`) omits `item` per schema.org.
 * Relative hrefs resolve against `options.origin`; without an origin a
 * relative item is omitted (never emit a relative `item` URL).
 */
export function createBreadcrumbJsonLd(
  items: BreadcrumbItemInput[],
  options: { origin?: string | null } = {},
): JsonLdObject | null {
  const normalizedItems = items
    .map((item) => {
      const name = item.label?.trim();

      return name
        ? {
            name,
            href: item.href?.trim() ?? null,
          }
        : null;
    })
    .filter((item): item is { name: string; href: string | null } => !!item);

  if (normalizedItems.length < 2) {
    return null;
  }

  const listItems = normalizedItems.map((item, index) => {
    const resolvedHref = item.href
      ? resolveBreadcrumbHref(item.href, options.origin ?? null)
      : null;

    const listItem: JsonLdObject = {
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
    };

    if (resolvedHref) {
      listItem.item = resolvedHref;
    }

    return listItem;
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: listItems,
  };
}

function resolveBreadcrumbHref(
  href: string,
  origin: string | null,
): string | null {
  if (isAbsoluteUrl(href)) {
    return href;
  }

  if (!origin) {
    return null;
  }

  const normalizedPath = href.startsWith('/') ? href : `/${href}`;

  return `${origin}${normalizedPath}`;
}

function isAbsoluteUrl(href: string) {
  return /^https?:\/\//i.test(href);
}

/**
 * A single crumb in the job-detail trail. Chrome crumbs (`home`, `jobs`) are
 * kinds — the application supplies display names. Record-derived crumbs keep
 * `name` because that name is data off the job (place, category, title).
 */
export type JobBreadcrumb =
  | { kind: 'home' | 'jobs'; path: string }
  | { kind: 'place' | 'category' | 'job'; name: string; path?: string };

/**
 * Home › Jobs › [country › region › city] › primaryCategory › Title.
 * The place crumbs link into the listing routes (`/jobs/locations/:slug`);
 * the category crumb nests under the most-specific place when present
 * (`/jobs/locations/:place/:category`), else `/jobs/:category`. The last
 * crumb (the job title) carries no `path` — the current page. Mirrors
 * page.tsx:336-367.
 *
 * Returns structural kinds for chrome crumbs and data names for record
 * crumbs. The application maps `kind` → display labels.
 */
export function buildJobBreadcrumbs(job: PublicJob): JobBreadcrumb[] {
  // Paths from `src/paths` — the package's single source of truth
  // (hand-built strings here would drift from the sitemap / doctor).
  const crumbs: JobBreadcrumb[] = [
    { kind: 'home', path: BOARD_PATHS.home },
    { kind: 'jobs', path: BOARD_PATHS.jobs },
  ];

  let lastPlaceSlug: string | null = null;
  for (const place of job.placeHierarchy) {
    lastPlaceSlug = place.slug;
    crumbs.push({
      kind: 'place',
      name: place.name,
      path: jobsLocationPath(place.slug),
    });
  }

  const primaryCategory = job.categories[0];
  if (primaryCategory) {
    crumbs.push({
      kind: 'category',
      name: primaryCategory.name,
      path: lastPlaceSlug
        ? jobsLocationCategoryPath(lastPlaceSlug, primaryCategory.slug)
        : jobsCategoryPath(primaryCategory.slug),
    });
  }

  crumbs.push({ kind: 'job', name: job.title });
  return crumbs;
}
