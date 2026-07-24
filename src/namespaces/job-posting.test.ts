import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

import type { CreateJobPostingInput } from '../types/job-posting';

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(body: unknown) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    jsonResponse(body),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const board = () =>
  createBoardClient({ baseUrl: 'https://api.cavuno.com', board: 'acme-jobs' });

const url = (spy: ReturnType<typeof stubFetch>) => spy.mock.calls[0]![0];
const init = (spy: ReturnType<typeof stubFetch>) => spy.mock.calls[0]![1]!;

afterEach(() => vi.unstubAllGlobals());

const SUBMISSION: CreateJobPostingInput = {
  submission: {
    companyName: 'Acme',
    contactName: 'Jane',
    contactEmail: 'jane@acme.com',
    title: 'Robotics Engineer',
    description: 'Build robots.',
    employmentType: 'full_time',
    remoteOption: 'remote',
    officeLocations: [],
    applicationUrl: 'https://acme.com/apply',
    salaryRangeEnabled: false,
  },
};

describe('board.jobPosting', () => {
  it('plans() GETs /job-postings/plans and passes the list through', async () => {
    const body = {
      object: 'list',
      data: [{ object: 'job_posting_plan', id: 'plans_1' }],
    };
    const spy = stubFetch(body);
    const result = await board().jobPosting.plans();
    expect(url(spy)).toBe(`${BASE}/job-postings/plans`);
    expect(result).toEqual(body);
  });

  it('plans({ purpose }) forwards the query param', async () => {
    const spy = stubFetch({ object: 'list', data: [] });
    await board().jobPosting.plans({ purpose: 'job_posting' });
    expect(url(spy)).toBe(`${BASE}/job-postings/plans?purpose=job_posting`);
  });

  it('create() POSTs the body to /job-postings and returns the discriminated result', async () => {
    const result = {
      object: 'job_posting_result',
      status: 'checkout',
      checkoutUrl: 'https://checkout.stripe.com/c/x',
      jobId: 'jobs_1',
    };
    const spy = stubFetch(result);
    const returned = await board().jobPosting.create(SUBMISSION);
    expect(url(spy)).toBe(`${BASE}/job-postings`);
    expect(init(spy).method).toBe('POST');
    expect(JSON.parse(init(spy).body as string)).toEqual(SUBMISSION);
    expect(returned).toEqual(result);
  });

  it('uploadLogo() POSTs the file as multipart form-data (no JSON content-type)', async () => {
    const result = {
      object: 'job_posting_logo',
      publicUrl: 'https://x/api/storage/k1',
    };
    const spy = stubFetch(result);
    const file = new Blob([new Uint8Array(8)], { type: 'image/png' });
    const returned = await board().jobPosting.uploadLogo(file);
    expect(url(spy)).toBe(`${BASE}/job-postings/logo`);
    expect(init(spy).method).toBe('POST');
    const body = init(spy).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(Blob);
    // Raw body — the client must NOT force application/json (it would clobber
    // the multipart boundary).
    const headers = new Headers(init(spy).headers as HeadersInit);
    expect(headers.get('content-type')).not.toBe('application/json');
    expect(returned).toEqual(result);
  });

  it('fetchLogoByDomain() GETs /job-postings/logo/fetch with the domain query', async () => {
    const result = {
      object: 'job_posting_logo',
      publicUrl: 'https://x/api/storage/k2',
    };
    const spy = stubFetch(result);
    const returned = await board().jobPosting.fetchLogoByDomain('acme.com');
    expect(url(spy)).toBe(`${BASE}/job-postings/logo/fetch?domain=acme.com`);
    expect(init(spy).method).toBe('GET');
    expect(returned).toEqual(result);
  });

  it('the billing helpers POST their bodies to their routes', async () => {
    const b = board();

    let spy = stubFetch({
      object: 'job_posting_billing_verification',
      success: true,
    });
    await b.jobPosting.sendBillingVerification({ email: 'a@b.com' });
    expect(url(spy)).toBe(`${BASE}/job-postings/send-verification`);
    expect(init(spy).method).toBe('POST');

    spy = stubFetch({ object: 'job_posting_billing_options', options: [] });
    await b.jobPosting.getBillingOptions({ verificationToken: 'tok' });
    expect(url(spy)).toBe(`${BASE}/job-postings/billing-options`);
    expect(init(spy).body).toBe('{"verificationToken":"tok"}');
  });
});
