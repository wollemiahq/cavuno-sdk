import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardClient } from '../index';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  resolveStorage,
} from '../storage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response | (() => Response)) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) =>
    typeof response === 'function' ? response() : response.clone(),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function makeAuthedBoard() {
  const storage = resolveStorage('memory');
  await storage.setItem(ACCESS_TOKEN_KEY, 'jwt');
  return createBoardClient({
    baseUrl: 'https://api.cavuno.com',
    board: 'acme-jobs',
    auth: { storage },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE = 'https://api.cavuno.com/v1/boards/acme-jobs';

describe('board.me', () => {
  it('retrieve GETs /me with the bearer token', async () => {
    const spy = stubFetch(jsonResponse({ object: 'board_user' }));
    const board = await makeAuthedBoard();
    await board.me.retrieve();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('updatePassword POSTs /me/password and persists the returned session', async () => {
    const session = {
      object: 'board_auth_session',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: 1765432100000,
      boardUser: {
        id: 'user_1',
        object: 'board_user',
        role: 'candidate',
        email: 'a@b.com',
        displayName: 'A',
        emailVerified: false,
      },
    };
    const spy = stubFetch(jsonResponse(session));
    const board = await makeAuthedBoard();
    const returned = await board.me.updatePassword({
      currentPassword: 'oldpass99',
      newPassword: 'newpass99',
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/password`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"currentPassword":"oldpass99","newPassword":"newpass99"}',
    );
    expect(returned).toEqual(session);
    expect(await board.client.storage.getItem(ACCESS_TOKEN_KEY)).toBe(
      'new-access',
    );
    expect(await board.client.storage.getItem(REFRESH_TOKEN_KEY)).toBe(
      'new-refresh',
    );
  });

  it('requestEmailChange POSTs /me/email', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.requestEmailChange({ email: 'new@example.com' }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/email`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"email":"new@example.com"}');
  });

  it('confirmEmailChange POSTs /me/email/confirm without requiring a session', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.confirmEmailChange({ token: 'tok' }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/email/confirm`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"tok"}');
  });

  it('profile.retrieve GETs /me/profile with the bearer token', async () => {
    const spy = stubFetch(jsonResponse({ object: 'candidate_profile' }));
    const board = await makeAuthedBoard();
    await board.me.profile.retrieve();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('profile.update PATCHes /me/profile with the merge-patch body', async () => {
    const spy = stubFetch(jsonResponse({ object: 'candidate_profile' }));
    const board = await makeAuthedBoard();
    await board.me.profile.update({ headline: 'Staff Engineer' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"headline":"Staff Engineer"}');
  });

  it('profile.handleAvailable GETs /me/profile/handle-available?handle=', async () => {
    const spy = stubFetch(
      jsonResponse({
        object: 'handle_availability',
        handle: 'jane',
        available: true,
      }),
    );
    const board = await makeAuthedBoard();
    await board.me.profile.handleAvailable('jane');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/profile/handle-available?handle=jane`,
    );
  });

  it('profile.createExperience POSTs /me/profile/experience', async () => {
    const spy = stubFetch(jsonResponse({ object: 'candidate_experience' }));
    const board = await makeAuthedBoard();
    await board.me.profile.createExperience({
      title: 'Engineer',
      companyName: 'Acme',
      startDate: '2020-01',
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile/experience`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('profile.updateExperience PATCHes /me/profile/experience/:id', async () => {
    const spy = stubFetch(jsonResponse({ object: 'candidate_experience' }));
    const board = await makeAuthedBoard();
    await board.me.profile.updateExperience('exp_1', { title: 'Senior' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile/experience/exp_1`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
  });

  it('profile.deleteExperience DELETEs and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.profile.deleteExperience('exp_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('profile.updateSkills PUTs the ordered names', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.profile.updateSkills({ skills: ['React', 'TS'] });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile/skills`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PUT');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"skills":["React","TS"]}');
  });

  it('profile.updateLanguages PUTs the ordered set', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.profile.updateLanguages({
      languages: [{ name: 'English', proficiency: 'native' }],
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile/languages`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PUT');
  });

  it('profile.uploadAvatar POSTs multipart form-data (no JSON content-type)', async () => {
    const spy = stubFetch(jsonResponse({ object: 'candidate_avatar' }));
    const board = await makeAuthedBoard();
    await board.me.profile.uploadAvatar(new Blob(['x'], { type: 'image/png' }));
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/profile/avatar`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBeInstanceOf(FormData);
  });

  it('notificationPreferences.retrieve GETs the list', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.notificationPreferences.retrieve();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/notification-preferences`);
  });

  it('notificationPreferences.update PUTs { channel, subscribed }', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.notificationPreferences.update({
      channel: 'messageEmails',
      subscribed: false,
    });
    expect(spy.mock.calls[0]![1]!.method).toBe('PUT');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"channel":"messageEmails","subscribed":false}',
    );
  });

  it('notificationPreferences.unsubscribeWithToken POSTs and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.notificationPreferences.unsubscribeWithToken({
        boardUserId: 'bu_1',
        channel: 'messageEmails',
        token: 't',
      }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/notification-preferences/unsubscribe`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('delete DELETEs /me and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(board.me.delete()).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('recommendedJobs.list GETs /me/recommended-jobs with query', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.recommendedJobs.list({ limit: 20, cursor: '20' });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/recommended-jobs?limit=20&cursor=20`,
    );
  });

  it('recommendedTalent.list GETs the company-scoped path with ?job=', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.recommendedTalent.list('analytical engines', {
      job: 'jobs_123',
      limit: 20,
      cursor: '20',
    });
    // The slug is path-encoded; `job` is required and rides the query string.
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/analytical%20engines/recommended-talent?job=jobs_123&limit=20&cursor=20`,
    );
  });

  it('savedJobs.list GETs /me/saved-jobs with query', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.savedJobs.list({ limit: 5, cursor: 'c1' });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/saved-jobs?limit=5&cursor=c1`,
    );
  });

  it('savedJobs.save POSTs { jobId }', async () => {
    const spy = stubFetch(jsonResponse({ object: 'saved_job' }));
    const board = await makeAuthedBoard();
    await board.me.savedJobs.save({ jobId: 'jobs_123' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/saved-jobs`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"jobId":"jobs_123"}');
  });

  it('savedJobs.unsave DELETEs /me/saved-jobs/:jobId and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.savedJobs.unsave('jobs_123'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/saved-jobs/jobs_123`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('alerts.list GETs /me/alerts with the bearer token', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.alerts.list();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/alerts`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('alerts.create POSTs the filter body', async () => {
    const spy = stubFetch(jsonResponse({ object: 'alert' }));
    const board = await makeAuthedBoard();
    await board.me.alerts.create({
      frequency: 'weekly',
      jobFunctions: ['engineering'],
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/alerts`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"frequency":"weekly","jobFunctions":["engineering"]}',
    );
  });

  it('alerts.retrieve GETs /me/alerts/:alertId', async () => {
    const spy = stubFetch(jsonResponse({ object: 'alert' }));
    const board = await makeAuthedBoard();
    await board.me.alerts.retrieve('jobalerts_1');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/alerts/jobalerts_1`);
  });

  it('alerts.update PUTs /me/alerts/:alertId (replace-in-full)', async () => {
    const spy = stubFetch(jsonResponse({ object: 'alert' }));
    const board = await makeAuthedBoard();
    await board.me.alerts.update('jobalerts_1', { frequency: 'weekly' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/alerts/jobalerts_1`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PUT');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"frequency":"weekly"}');
  });

  it('alerts.remove DELETEs /me/alerts/:alertId and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.alerts.remove('jobalerts_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/alerts/jobalerts_1`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('applications.list GETs /me/applications with query', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.applications.list({ limit: 10 });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/applications?limit=10`);
  });

  it('applications.retrieve GETs /me/applications/:id', async () => {
    const spy = stubFetch(jsonResponse({ object: 'application' }));
    const board = await makeAuthedBoard();
    await board.me.applications.retrieve('jobapplications_1');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/applications/jobapplications_1`,
    );
  });

  it('applications.updateFacts PATCHes /me/applications/:id', async () => {
    const spy = stubFetch(jsonResponse({ object: 'application' }));
    const board = await makeAuthedBoard();
    await board.me.applications.updateFacts('jobapplications_1', {
      coverNote: 'hi',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/applications/jobapplications_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"coverNote":"hi"}');
  });

  it('applications.withdraw POSTs /me/applications/:id/withdraw and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.applications.withdraw('jobapplications_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/applications/jobapplications_1/withdraw`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('companies.search GETs /me/companies/search?q=', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.search({ q: 'acme' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/search?q=acme`);
  });

  it('companies.list GETs /me/companies', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.list();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies`);
  });

  it('companies.create POSTs { name, website }', async () => {
    const spy = stubFetch(jsonResponse({ object: 'company_membership' }));
    const board = await makeAuthedBoard();
    await board.me.companies.create({ name: 'Acme', website: 'acme.com' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"name":"Acme","website":"acme.com"}',
    );
  });

  it('companies.claim POSTs /me/companies/:slug/claim', async () => {
    const spy = stubFetch(jsonResponse({ object: 'company_membership' }));
    const board = await makeAuthedBoard();
    await board.me.companies.claim('acme');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/claim`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('companies.cancelClaim DELETEs and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.cancelClaim('acme'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/claim`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.update PATCHes /me/companies/:slug', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_company' }));
    const board = await makeAuthedBoard();
    await board.me.companies.update('acme', { website: 'acme.io' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"website":"acme.io"}');
  });

  it('companies.delete DELETEs /me/companies/:slug and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(board.me.companies.delete('acme')).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.listMembers GETs /me/companies/:slug/members', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.listMembers('acme');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/members`);
  });

  it('companies.updateMemberRole PATCHes /me/companies/:slug/members/:id', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.updateMemberRole('acme', 'mem_1', { role: 'admin' }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/members/mem_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"role":"admin"}');
  });

  it('companies.removeMember DELETEs /me/companies/:slug/members/:id', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.removeMember('acme', 'mem_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/members/mem_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.leave DELETEs /me/companies/:slug/membership and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(board.me.companies.leave('acme')).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/membership`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.listInvites GETs /me/companies/:slug/invites', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.listInvites('acme');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/invites`);
  });

  it('companies.createInvite POSTs { email }', async () => {
    const spy = stubFetch(jsonResponse({ object: 'company_member_invite' }));
    const board = await makeAuthedBoard();
    await board.me.companies.createInvite('acme', { email: 'ada@acme.test' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/invites`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"email":"ada@acme.test"}');
  });

  it('companies.revokeInvite DELETEs /me/companies/:slug/invites/:id', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.revokeInvite('acme', 'inv_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/invites/inv_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('acceptInvite POSTs /me/invites/accept', async () => {
    const spy = stubFetch(
      jsonResponse({
        object: 'company_member_invite_acceptance',
        companySlug: 'acme',
      }),
    );
    const board = await makeAuthedBoard();
    await board.me.acceptInvite({ token: 'tok' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/invites/accept`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"tok"}');
  });

  it('companies.workEmail.verify POSTs /me/companies/:slug/work-email/verify', async () => {
    const spy = stubFetch(jsonResponse({ object: 'company_membership' }));
    const board = await makeAuthedBoard();
    await board.me.companies.workEmail.verify('acme', {
      workEmail: 'me@acme.com',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/work-email/verify`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"workEmail":"me@acme.com"}');
  });

  it('companies.workEmail.confirm POSTs /me/companies/:slug/work-email/confirm (no bearer needed)', async () => {
    const spy = stubFetch(jsonResponse({ object: 'company_membership' }));
    const board = await makeAuthedBoard();
    await board.me.companies.workEmail.confirm('acme', { token: 'tok' });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/work-email/confirm`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"token":"tok"}');
  });

  it('companies.jobs.list GETs /me/companies/:slug/jobs with limit', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.list('acme', { limit: 50 });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/jobs?limit=50`,
    );
  });

  it('companies.jobs.retrieve GETs /me/companies/:slug/jobs/:id', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_job' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.retrieve('acme', 'jobs_1');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/jobs/jobs_1`);
  });

  it('companies.jobs.create POSTs /me/companies/:slug/jobs', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_job' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.create('acme', {
      title: 'Staff Engineer',
      description: 'Build things.',
      applicationUrl: 'https://acme.com/apply',
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/jobs`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"title":"Staff Engineer","description":"Build things.","applicationUrl":"https://acme.com/apply"}',
    );
  });

  it('companies.jobs.update PATCHes /me/companies/:slug/jobs/:id', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_job' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.update('acme', 'jobs_1', {
      salaryMax: 220000,
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/jobs/jobs_1`);
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"salaryMax":220000}');
  });

  it('companies.jobs.delete DELETEs and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.jobs.delete('acme', 'jobs_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/jobs/jobs_1`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.jobs.publish POSTs /me/companies/:slug/jobs/:id/publish', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_job' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.publish('acme', 'jobs_1');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/jobs/jobs_1/publish`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('companies.jobs.unpublish POSTs /me/companies/:slug/jobs/:id/unpublish', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_job' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.unpublish('acme', 'jobs_1');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/jobs/jobs_1/unpublish`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('companies.applicants.list GETs /me/companies/:slug/applicants?job=', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_pipeline' }));
    const board = await makeAuthedBoard();
    await board.me.companies.applicants.list('acme', {
      job: 'jobs_1',
      stage: 'review',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/applicants?job=jobs_1&stage=review`,
    );
  });

  it('companies.applicants.move PATCHes /applicants/:id/stage and resolves void on 204', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.applicants.move('acme', 'app_1', {
        stageId: 'stage_1',
      }),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/applicants/app_1/stage`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"stageId":"stage_1"}');
  });

  it('companies.applicants.bulkMove POSTs /applicants/bulk/move', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.applicants.bulkMove('acme', {
      applicationIds: ['app_1', 'app_2'],
      stageId: 'stage_1',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/applicants/bulk/move`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"applicationIds":["app_1","app_2"],"stageId":"stage_1"}',
    );
  });

  it('companies.applicants.bulkReject POSTs /applicants/bulk/reject', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.applicants.bulkReject('acme', {
      applicationIds: ['app_1'],
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/applicants/bulk/reject`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('companies.applicants.addNote POSTs /applicants/:id/notes', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.applicants.addNote('acme', 'app_1', {
      body: 'Strong candidate.',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/applicants/app_1/notes`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"body":"Strong candidate."}');
  });

  it('companies.pipelineStages.create POSTs /pipeline-stages', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.pipelineStages.create('acme', {
      jobId: 'jobs_1',
      label: 'Phone screen',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/pipeline-stages`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"jobId":"jobs_1","label":"Phone screen"}',
    );
  });

  it('companies.pipelineStages.update PATCHes /pipeline-stages/:stageId', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.pipelineStages.update('acme', 'stage_1', {
      label: 'Tech screen',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/pipeline-stages/stage_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('PATCH');
    expect(spy.mock.calls[0]![1]!.body).toBe('{"label":"Tech screen"}');
  });

  it('companies.pipelineStages.remove DELETEs /pipeline-stages/:stageId', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(
      board.me.companies.pipelineStages.remove('acme', 'stage_1'),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/pipeline-stages/stage_1`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });

  it('companies.pipelineStages.reorder PUTs /pipeline-stages/reorder', async () => {
    const spy = stubFetch(() => new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await board.me.companies.pipelineStages.reorder('acme', {
      jobId: 'jobs_1',
      orderedStageIds: ['stage_1', 'stage_2'],
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/pipeline-stages/reorder`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('PUT');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"jobId":"jobs_1","orderedStageIds":["stage_1","stage_2"]}',
    );
  });

  it('companies.billingOptions.list GETs /me/companies/:slug/billing-options', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.billingOptions.list('acme');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/billing-options`,
    );
  });

  it('companies.jobStats.retrieve GETs /me/companies/:slug/job-stats', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobStats.retrieve('acme');
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/companies/acme/job-stats`);
  });

  it('companies.jobStats.timeseries GETs the timeseries path with the window query', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobStats.timeseries('acme', {
      since: '2026-06-01T00:00:00.000Z',
      until: '2026-07-01T00:00:00.000Z',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/job-stats/timeseries?since=2026-06-01T00%3A00%3A00.000Z&until=2026-07-01T00%3A00%3A00.000Z`,
    );
  });

  it('companies.jobStats.timeseries omits the query when no window is given', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobStats.timeseries('acme');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/job-stats/timeseries`,
    );
  });

  it('companies.profileStats.retrieve GETs /me/companies/:slug/profile-stats', async () => {
    const spy = stubFetch(
      jsonResponse({ object: 'employer_profile_stats', profileViews: 0 }),
    );
    const board = await makeAuthedBoard();
    await board.me.companies.profileStats.retrieve('acme');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/profile-stats`,
    );
  });

  it('companies.profileStats.timeseries GETs the sparkline path with the window query', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.profileStats.timeseries('acme', {
      since: '2026-06-01T00:00:00.000Z',
      until: '2026-07-01T00:00:00.000Z',
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/profile-stats/timeseries?since=2026-06-01T00%3A00%3A00.000Z&until=2026-07-01T00%3A00%3A00.000Z`,
    );
  });

  it('companies.profileStats.timeseries omits the query when no window is given', async () => {
    const spy = stubFetch(jsonResponse({ object: 'list', data: [] }));
    const board = await makeAuthedBoard();
    await board.me.companies.profileStats.timeseries('acme');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/profile-stats/timeseries`,
    );
  });

  it('companies.jobs.checkout POSTs /me/companies/:slug/jobs/:id/checkout', async () => {
    const spy = stubFetch(jsonResponse({ object: 'employer_checkout' }));
    const board = await makeAuthedBoard();
    await board.me.companies.jobs.checkout('acme', 'jobs_1', {
      billing: { type: 'new', planId: 'plan_1' },
    });
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/companies/acme/jobs/jobs_1/checkout`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"billing":{"type":"new","planId":"plan_1"}}',
    );
  });

  it('talentAccess.retrieve GETs /me/talent-access with the bearer token', async () => {
    const spy = stubFetch(
      jsonResponse({
        object: 'talent_access',
        isEmployer: true,
        paywallActive: true,
        hasTalentAccess: true,
        hasUnlimitedUnlocks: false,
      }),
    );
    const board = await makeAuthedBoard();
    const access = await board.me.talentAccess.retrieve();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/talent-access`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
    expect(access.hasTalentAccess).toBe(true);
  });
});

describe('board.me.resume', () => {
  it('upload POSTs multipart form-data to /me/resume with the resume field + options', async () => {
    const spy = stubFetch(
      jsonResponse({ object: 'resume', parseStatus: 'parsing' }, 202),
    );
    const board = await makeAuthedBoard();
    await board.me.resume.upload(
      new Blob(['%PDF-'], { type: 'application/pdf' }),
      {
        keepResumeOnFile: true,
        importMode: 'replace_all',
        confirmReplaceAll: true,
      },
    );
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/resume`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    const body = spy.mock.calls[0]![1]!.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('resume')).toBeInstanceOf(Blob);
    expect(body.get('keepResumeOnFile')).toBe('true');
    expect(body.get('importMode')).toBe('replace_all');
    expect(body.get('confirmReplaceAll')).toBe('true');
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('upload omits the option fields when no options are passed', async () => {
    const spy = stubFetch(
      jsonResponse({ object: 'resume', parseStatus: 'parsing' }, 202),
    );
    const board = await makeAuthedBoard();
    await board.me.resume.upload(
      new Blob(['%PDF-'], { type: 'application/pdf' }),
    );
    const body = spy.mock.calls[0]![1]!.body as FormData;
    expect(body.get('resume')).toBeInstanceOf(Blob);
    expect(body.get('keepResumeOnFile')).toBeNull();
    expect(body.get('importMode')).toBeNull();
  });

  it('retrieve GETs /me/resume with the bearer token', async () => {
    const spy = stubFetch(
      jsonResponse({ object: 'resume', parseStatus: 'parsed' }),
    );
    const board = await makeAuthedBoard();
    await board.me.resume.retrieve();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/resume`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('delete DELETEs /me/resume and resolves void on 204', async () => {
    const spy = stubFetch(new Response(null, { status: 204 }));
    const board = await makeAuthedBoard();
    await expect(board.me.resume.delete()).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/resume`);
    expect(spy.mock.calls[0]![1]!.method).toBe('DELETE');
  });
});

describe('board.me.access (candidate paywall)', () => {
  it('checkout POSTs the offer body to /me/access/checkout with the bearer token', async () => {
    const spy = stubFetch(jsonResponse({ object: 'checkout_session' }));
    const board = await makeAuthedBoard();
    await board.me.access.checkout({
      offerKey: 'monthly',
      returnPath: '/account/access',
      colorMode: 'light',
    });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/access/checkout`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"offerKey":"monthly","returnPath":"/account/access","colorMode":"light"}',
    );
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('retrieveCheckout GETs the session-scoped state route (encoded)', async () => {
    const spy = stubFetch(jsonResponse({ object: 'checkout_session_state' }));
    const board = await makeAuthedBoard();
    await board.me.access.retrieveCheckout('cs_test/123');
    expect(spy.mock.calls[0]![0]).toBe(
      `${BASE}/me/access/checkout/cs_test%2F123`,
    );
    expect(spy.mock.calls[0]![1]!.method).toBe('GET');
  });

  it('grant GETs /me/access/grant with the bearer token', async () => {
    const spy = stubFetch(jsonResponse({ object: 'access_grant' }));
    const board = await makeAuthedBoard();
    await board.me.access.grant();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/access/grant`);
    const headers = spy.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('portal POSTs /me/access/portal with an optional returnPath body', async () => {
    const spy = stubFetch(jsonResponse({ object: 'portal_session' }));
    const board = await makeAuthedBoard();
    await board.me.access.portal({ returnPath: '/account/billing' });
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/access/portal`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBe(
      '{"returnPath":"/account/billing"}',
    );
  });

  it('portal works with no body', async () => {
    const spy = stubFetch(jsonResponse({ object: 'portal_session' }));
    const board = await makeAuthedBoard();
    await board.me.access.portal();
    expect(spy.mock.calls[0]![0]).toBe(`${BASE}/me/access/portal`);
    expect(spy.mock.calls[0]![1]!.method).toBe('POST');
    expect(spy.mock.calls[0]![1]!.body).toBeUndefined();
  });
});
