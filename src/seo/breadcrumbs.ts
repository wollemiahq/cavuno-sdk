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
import { uiCopy } from '../format/ui-copy';

import type { BoardLabelOverrides } from '../format/ui-copy';
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
 * Home › Jobs › [country › region › city] › primaryCategory › Title.
 * The place crumbs link into the listing routes (`/jobs/locations/:slug`);
 * the category crumb nests under the most-specific place when present
 * (`/jobs/locations/:place/:category`), else `/jobs/:category`. The last
 * crumb (the job title) carries no `path` — the current page. Mirrors
 * page.tsx:336-367.
 *
 * The Home/Jobs crumb names resolve from the copy catalog per board
 * language ⊕ operator overrides; omitting `language` keeps the
 * English source, so existing call sites render unchanged.
 */
export function buildJobBreadcrumbs(
  job: PublicJob,
  language?: string,
  labels?: BoardLabelOverrides,
): Array<{ name: string; path?: string }> {
  const copy = uiCopy(language, labels).breadcrumbs;
  const crumbs: Array<{ name: string; path?: string }> = [
    { name: copy.home, path: '/' },
    { name: copy.jobs, path: '/jobs' },
  ];

  let lastPlaceSlug: string | null = null;
  for (const place of job.placeHierarchy) {
    lastPlaceSlug = place.slug;
    crumbs.push({ name: place.name, path: `/jobs/locations/${place.slug}` });
  }

  const primaryCategory = job.categories[0];
  if (primaryCategory) {
    crumbs.push({
      name: primaryCategory.name,
      path: lastPlaceSlug
        ? `/jobs/locations/${lastPlaceSlug}/${primaryCategory.slug}`
        : `/jobs/${primaryCategory.slug}`,
    });
  }

  crumbs.push({ name: job.title });
  return crumbs;
}
