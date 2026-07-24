import { describe, expect, it, vi } from 'vitest';

import {
  createGoHandler,
  resolveGoRedirect,
  goResponseHeaders,
} from './create-go-handler';

/**
 *   — SDK /go handler contract (unit-level with faked data client).
 */

describe('resolveGoRedirect (SDK)', () => {
  it('job + resolved slugs → jobDetail path', () => {
    expect(
      resolveGoRedirect(['job', 'j1'], '', {
        companySlug: 'acme',
        jobSlug: 'chef',
      }),
    ).toEqual({
      location: '/companies/acme/jobs/chef',
      status: 302,
    });
  });

  it('job + null → jobs index', () => {
    expect(resolveGoRedirect(['job', 'garbage'], '', null)).toEqual({
      location: '/jobs',
      status: 302,
    });
  });

  it('alerts-manage / alerts-confirm preserve query', () => {
    expect(
      resolveGoRedirect(['alerts-manage'], '?token=abc&x=1', null),
    ).toEqual({
      location: '/alerts/manage?token=abc&x=1',
      status: 302,
    });
    expect(resolveGoRedirect(['alerts-confirm'], '?token=z', null)).toEqual({
      location: '/alerts/confirm?token=z',
      status: 302,
    });
  });

  it('unknown role → jobs index', () => {
    expect(resolveGoRedirect(['nonsense'], '', null)).toEqual({
      location: '/jobs',
      status: 302,
    });
  });
});

describe('createGoHandler', () => {
  it('with faked lookupJob resolves to job detail + noindex', async () => {
    const handler = createGoHandler({
      lookupJob: async (id) =>
        id === 'job_valid'
          ? { companySlug: 'acme', jobSlug: 'senior-chef' }
          : null,
    });

    const res = await handler(
      new Request('https://jobs.example.com/go/job/job_valid'),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('Location')).toBe(
      'https://jobs.example.com/companies/acme/jobs/senior-chef',
    );
    expect(res.body).toBeNull();
  });

  it('other-board / garbage id → jobs index (same body for both)', async () => {
    const handler = createGoHandler({
      lookupJob: async () => null,
    });

    const a = await handler(
      new Request('https://jobs.example.com/go/job/other-board'),
    );
    const b = await handler(
      new Request('https://jobs.example.com/go/job/not-an-id'),
    );

    expect(a.status).toBe(302);
    expect(b.status).toBe(302);
    expect(a.headers.get('Location')).toBe('https://jobs.example.com/jobs');
    expect(b.headers.get('Location')).toBe('https://jobs.example.com/jobs');
    expect(a.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('alerts-manage preserves query string verbatim', async () => {
    const handler = createGoHandler({});
    const res = await handler(
      new Request('https://jobs.example.com/go/alerts-manage?token=abc&x=1'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(
      'https://jobs.example.com/alerts/manage?token=abc&x=1',
    );
  });

  it('alerts-confirm preserves query string verbatim', async () => {
    const handler = createGoHandler({});
    const res = await handler(
      new Request('https://jobs.example.com/go/alerts-confirm?token=z'),
    );
    expect(res.headers.get('Location')).toBe(
      'https://jobs.example.com/alerts/confirm?token=z',
    );
  });

  it('unknown role → jobs index', async () => {
    const handler = createGoHandler({});
    const res = await handler(
      new Request('https://jobs.example.com/go/nonsense'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://jobs.example.com/jobs');
  });

  it('without lookupJob, job always degrades to jobs index', async () => {
    const handler = createGoHandler({});
    const res = await handler(
      new Request('https://jobs.example.com/go/job/any-real-id'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://jobs.example.com/jobs');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('lookupJob is only called for the job role', async () => {
    const lookupJob = vi.fn(async () => ({
      companySlug: 'a',
      jobSlug: 'b',
    }));
    const handler = createGoHandler({ lookupJob });

    await handler(new Request('https://jobs.example.com/go/alerts-manage?t=1'));
    expect(lookupJob).not.toHaveBeenCalled();

    await handler(new Request('https://jobs.example.com/go/job/j1'));
    expect(lookupJob).toHaveBeenCalledWith('j1');
  });

  it('goResponseHeaders always includes noindex', () => {
    expect(goResponseHeaders()['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  // partsFromRequest segment-boundary parsing
  it("'/google/x' does not match /go substring; falls back to jobs index", async () => {
    const handler = createGoHandler({
      lookupJob: async () => ({ companySlug: 'a', jobSlug: 'b' }),
    });
    const res = await handler(new Request('https://jobs.example.com/google/x'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://jobs.example.com/jobs');
  });

  it("'/go/alerts-manage' still works after segment parse", async () => {
    const handler = createGoHandler({});
    const res = await handler(
      new Request('https://jobs.example.com/go/alerts-manage?token=t'),
    );
    expect(res.headers.get('Location')).toBe(
      'https://jobs.example.com/alerts/manage?token=t',
    );
  });

  it("'/docs/go/job/x' parses parts after the exact go segment", async () => {
    const lookupJob = vi.fn(async () => ({
      companySlug: 'acme',
      jobSlug: 'chef',
    }));
    const handler = createGoHandler({ lookupJob });
    const res = await handler(
      new Request('https://jobs.example.com/docs/go/job/job_nested'),
    );
    expect(lookupJob).toHaveBeenCalledWith('job_nested');
    expect(res.headers.get('Location')).toBe(
      'https://jobs.example.com/companies/acme/jobs/chef',
    );
  });
});
