import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';

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

describe('board.jobAlerts', () => {
  it('subscribe POSTs the body to /job-alerts', async () => {
    const spy = stubFetch({
      object: 'job_alert_subscription',
      status: 'submitted',
    });
    await board().jobAlerts.subscribe({
      email: 'a@b.com',
      consent: true,
      filters: { jobFunctions: ['robotics'] },
    });
    expect(url(spy)).toBe(`${BASE}/job-alerts`);
    expect(init(spy).method).toBe('POST');
    expect(JSON.parse(init(spy).body as string)).toEqual({
      email: 'a@b.com',
      consent: true,
      filters: { jobFunctions: ['robotics'] },
    });
  });

  it('confirm POSTs the token to /job-alerts/confirm', async () => {
    const spy = stubFetch({
      object: 'job_alert_confirmation',
      status: 'confirmed',
    });
    await board().jobAlerts.confirm({ token: 'tok' });
    expect(url(spy)).toBe(`${BASE}/job-alerts/confirm`);
    expect(init(spy).method).toBe('POST');
    expect(init(spy).body).toBe('{"token":"tok"}');
  });

  it('resendConfirmation POSTs the email', async () => {
    const spy = stubFetch({
      object: 'job_alert_confirmation_resend',
      status: 'submitted',
    });
    await board().jobAlerts.resendConfirmation({ email: 'a@b.com' });
    expect(url(spy)).toBe(`${BASE}/job-alerts/resend-confirmation`);
    expect(init(spy).method).toBe('POST');
  });

  it('manage GETs with the subscription + token in the query string', async () => {
    const spy = stubFetch({
      object: 'job_alert_manage_state',
      preferences: [],
    });
    await board().jobAlerts.manage({ subscription: 'bu_1', token: 'tok' });
    expect(url(spy)).toBe(
      `${BASE}/job-alerts/manage?subscription=bu_1&token=tok`,
    );
    // GET → no method override / no body.
    expect(init(spy).method ?? 'GET').toBe('GET');
  });

  it('unsubscribe + resubscribe POST the manage token body', async () => {
    const spy = stubFetch({ object: 'job_alert_manage_result', success: true });
    await board().jobAlerts.unsubscribe({
      subscriptionId: 'bu_1',
      token: 'tok',
    });
    expect(url(spy)).toBe(`${BASE}/job-alerts/unsubscribe`);
    expect(init(spy).method).toBe('POST');

    const spy2 = stubFetch({
      object: 'job_alert_manage_result',
      success: true,
    });
    await board().jobAlerts.resubscribe({
      subscriptionId: 'bu_1',
      token: 'tok',
    });
    expect(url(spy2)).toBe(`${BASE}/job-alerts/resubscribe`);
  });

  it('unsubscribe forwards the digest attribution', async () => {
    const spy = stubFetch({ object: 'job_alert_manage_result', success: true });
    await board().jobAlerts.unsubscribe({
      subscriptionId: 'bu_1',
      token: 'tok',
      alertId: 'k57d2x1tq8m3ffhr4y6v9b0n7s7tqa12',
      emailId: '0123456789abcdef',
    });
    expect(JSON.parse(init(spy).body as string)).toEqual({
      subscriptionId: 'bu_1',
      token: 'tok',
      alertId: 'k57d2x1tq8m3ffhr4y6v9b0n7s7tqa12',
      emailId: '0123456789abcdef',
    });
  });

  it('recordClick POSTs the click to /job-alerts/clicks', async () => {
    const spy = stubFetch({ object: 'job_alert_click', status: 'accepted' });
    const click = {
      alertId: 'k57d2x1tq8m3ffhr4y6v9b0n7s7tqa12',
      emailId: '0123456789abcdef',
      jobId: 'j57d2x1tq8m3ffhr4y6v9b0n7s7tqa99',
      position: 2,
      matcherVersion: 'alert-exact-v1',
      userAgent: 'Mozilla/5.0',
    };
    const receipt = await board().jobAlerts.recordClick(click);
    expect(url(spy)).toBe(`${BASE}/job-alerts/clicks`);
    expect(init(spy).method).toBe('POST');
    expect(JSON.parse(init(spy).body as string)).toEqual(click);
    expect(receipt).toEqual({ object: 'job_alert_click', status: 'accepted' });
  });

  it('updatePreference POSTs + deletePreference DELETEs /job-alerts/preferences', async () => {
    const spy = stubFetch({ object: 'job_alert_manage_result', success: true });
    await board().jobAlerts.updatePreference({
      subscriptionId: 'bu_1',
      preferenceId: 'ja_1',
      token: 'tok',
      frequency: 'weekly',
    });
    expect(url(spy)).toBe(`${BASE}/job-alerts/preferences`);
    expect(init(spy).method).toBe('POST');

    const spy2 = stubFetch({
      object: 'job_alert_manage_result',
      success: true,
    });
    await board().jobAlerts.deletePreference({
      subscriptionId: 'bu_1',
      preferenceId: 'ja_1',
      token: 'tok',
    });
    expect(url(spy2)).toBe(`${BASE}/job-alerts/preferences`);
    expect(init(spy2).method).toBe('DELETE');
  });
});
