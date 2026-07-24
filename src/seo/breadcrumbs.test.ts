import { describe, expect, it } from 'vitest';

import { buildJobBreadcrumbs } from './breadcrumbs';

import type { PublicJob } from '../types/jobs';

function job(overrides: Partial<PublicJob>): PublicJob {
  return {
    title: 'Senior Backend Engineer',
    placeHierarchy: [],
    categories: [],
    ...overrides,
  } as PublicJob;
}

describe('buildJobBreadcrumbs', () => {
  it('always starts Home › Jobs and ends with the untitled current page', () => {
    const crumbs = buildJobBreadcrumbs(job({}));
    expect(crumbs[0]).toEqual({ name: 'Home', path: '/' });
    expect(crumbs[1]).toEqual({ name: 'Jobs', path: '/jobs' });
    // Last crumb (the title) carries no path — it's the current page.
    expect(crumbs.at(-1)).toEqual({ name: 'Senior Backend Engineer' });
  });

  it('nests the category under the most-specific place when both exist', () => {
    const crumbs = buildJobBreadcrumbs(
      job({
        placeHierarchy: [
          { name: 'Germany', slug: 'germany' },
          { name: 'Berlin', slug: 'berlin' },
        ],
        categories: [{ name: 'Engineering', slug: 'engineering' }],
      } as Partial<PublicJob>),
    );
    expect(crumbs).toContainEqual({
      name: 'Berlin',
      path: '/jobs/locations/berlin',
    });
    expect(crumbs).toContainEqual({
      name: 'Engineering',
      path: '/jobs/locations/berlin/engineering',
    });
  });

  it('links the category at /jobs/:category when there is no place', () => {
    const crumbs = buildJobBreadcrumbs(
      job({
        categories: [{ name: 'Engineering', slug: 'engineering' }],
      } as Partial<PublicJob>),
    );
    expect(crumbs).toContainEqual({
      name: 'Engineering',
      path: '/jobs/engineering',
    });
  });

  it('resolves the Home/Jobs crumbs from the copy catalog per board language', () => {
    const crumbs = buildJobBreadcrumbs(job({}), 'de');
    expect(crumbs[0]).toEqual({ name: 'Startseite', path: '/' });
    expect(crumbs[1]).toEqual({ name: 'Jobs', path: '/jobs' });
  });

  it('applies operator breadcrumb overrides on top of the catalog', () => {
    const crumbs = buildJobBreadcrumbs(job({}), 'de', {
      breadcrumbsLabels: { home: 'Start', jobs: 'Stellen' },
    });
    expect(crumbs[0]).toEqual({ name: 'Start', path: '/' });
    expect(crumbs[1]).toEqual({ name: 'Stellen', path: '/jobs' });
  });
});
