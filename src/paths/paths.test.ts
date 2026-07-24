import { describe, expect, it } from 'vitest';

import {
  BOARD_PATHS,
  blogAuthorPath,
  blogPostPath,
  blogTagPath,
  boardUrl,
  companyMarketPath,
  companyPath,
  companySalaryPath,
  goAlertsConfirmPath,
  goAlertsManagePath,
  goJobPath,
  jobDetailPath,
  jobsCategoryPath,
  jobsLocationPath,
  jobsSkillPath,
  salaryLocationPath,
  salarySkillPath,
  salaryTitlePath,
} from './index';

/**
 * These assertions pin the canonical URL structure — the hosted board's
 * indexed URLs. A change here is a migration-parity break across ~50
 * surfaces; it must be deliberate and paired with the hosted
 * board + the sitemap golden test.
 */
describe('canonical board paths', () => {
  it('builds the job-detail path from both slugs', () => {
    expect(jobDetailPath('acme-co', 'senior-engineer')).toBe(
      '/companies/acme-co/jobs/senior-engineer',
    );
  });

  it('builds taxonomy listing paths', () => {
    expect(jobsCategoryPath('engineering')).toBe('/jobs/engineering');
    expect(jobsSkillPath('react')).toBe('/jobs/skills/react');
    expect(jobsLocationPath('berlin')).toBe('/jobs/locations/berlin');
  });

  it('builds company + market paths', () => {
    expect(companyPath('acme-co')).toBe('/companies/acme-co');
    expect(companyMarketPath('fintech')).toBe('/companies/markets/fintech');
    expect(companySalaryPath('acme-co')).toBe('/companies/acme-co/salaries');
  });

  it('builds salary + blog paths', () => {
    expect(salaryTitlePath('engineer')).toBe('/salaries/titles/engineer');
    expect(salarySkillPath('react')).toBe('/salaries/skills/react');
    expect(salaryLocationPath('berlin')).toBe('/salaries/locations/berlin');
    expect(blogPostPath('hello')).toBe('/blog/hello');
    expect(blogTagPath('news')).toBe('/blog/tag/news');
    expect(blogAuthorPath('jane')).toBe('/blog/author/jane');
  });

  it('exposes the static chrome paths', () => {
    expect(BOARD_PATHS.jobs).toBe('/jobs');
    expect(BOARD_PATHS.salaryTitles).toBe('/salaries/titles');
    // alert-email surfaces ride the paths module.
    expect(BOARD_PATHS.alertsManage).toBe('/alerts/manage');
    expect(BOARD_PATHS.alertsConfirm).toBe('/alerts/confirm');
  });

  it('prefixes an origin, tolerating a trailing slash', () => {
    expect(boardUrl('https://x.com', jobDetailPath('a', 'b'))).toBe(
      'https://x.com/companies/a/jobs/b',
    );
    expect(boardUrl('https://x.com/', jobDetailPath('a', 'b'))).toBe(
      'https://x.com/companies/a/jobs/b',
    );
  });
});

/**
 *  /   — email composers build /go paths via pure helpers
 * (not @cavuno/board/go). Shapes must match the hosted handler + SDK
 * createGoHandler contracts; no encodeURIComponent on ids.
 */
describe('go path builders', () => {
  it('builds /go/job/<id> without encoding the id', () => {
    expect(goJobPath('jh7abc123')).toBe('/go/job/jh7abc123');
    // Resource ids are opaque path segments — pass through verbatim.
    const rawId = 'nd784sm0h3rpffnvp67jhqnf7h842z7p';
    expect(goJobPath(rawId)).toBe(`/go/job/${rawId}`);
    expect(goJobPath('job_abc-XYZ')).toBe('/go/job/job_abc-XYZ');
  });

  it('builds static alerts role paths matching the /go handler roles', () => {
    expect(goAlertsManagePath()).toBe('/go/alerts-manage');
    expect(goAlertsConfirmPath()).toBe('/go/alerts-confirm');
  });

  it('boardUrl prefixes go paths the same way as canonical paths', () => {
    expect(boardUrl('https://x.com', goJobPath('j1'))).toBe(
      'https://x.com/go/job/j1',
    );
    expect(boardUrl('https://x.com/', goAlertsManagePath())).toBe(
      'https://x.com/go/alerts-manage',
    );
  });
});
