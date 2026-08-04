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
  it('always starts home › jobs kinds and ends with the job title crumb', () => {
    const crumbs = buildJobBreadcrumbs(job({}));
    expect(crumbs[0]).toEqual({ kind: 'home', path: '/' });
    expect(crumbs[1]).toEqual({ kind: 'jobs', path: '/jobs' });
    // Last crumb (the title) carries no path — it's the current page.
    expect(crumbs.at(-1)).toEqual({
      kind: 'job',
      name: 'Senior Backend Engineer',
    });
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
      kind: 'place',
      name: 'Berlin',
      path: '/jobs/locations/berlin',
    });
    expect(crumbs).toContainEqual({
      kind: 'category',
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
      kind: 'category',
      name: 'Engineering',
      path: '/jobs/engineering',
    });
  });

  it('does not pick chrome words — home/jobs are kinds only', () => {
    const crumbs = buildJobBreadcrumbs(job({}));
    expect(crumbs[0]).toEqual({ kind: 'home', path: '/' });
    expect(crumbs[1]).toEqual({ kind: 'jobs', path: '/jobs' });
    // No `name` on chrome crumbs — the application supplies display labels.
    expect('name' in crumbs[0]!).toBe(false);
    expect('name' in crumbs[1]!).toBe(false);
  });
});
