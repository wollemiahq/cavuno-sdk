import { describe, expect, it } from 'vitest';

import {
  BoardApiError,
  isBoardApiError,
  isBoardPasswordRequired,
  isConflict,
  isFreeEmailWebsiteError,
  isForbidden,
  isNotFound,
  isRateLimited,
  isSsoBrowserMismatch,
  isSsoRequired,
  isSignInMethodUnavailable,
  isUnauthorized,
  isValidationError,
} from './errors';

function makeError(status: number, code: string) {
  return new BoardApiError({
    status,
    code,
    message: 'something went wrong',
    details: { field: 'email' },
    requestId: 'req_abc123',
    raw: { error: { code, message: 'something went wrong' } },
  });
}

describe('BoardApiError', () => {
  it('exposes status, code, message, details, requestId, and raw from the envelope', () => {
    const err = makeError(404, 'jobs_not_found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('jobs_not_found');
    expect(err.message).toBe('something went wrong');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.requestId).toBe('req_abc123');
    expect(err.raw).toEqual({
      error: { code: 'jobs_not_found', message: 'something went wrong' },
    });
  });

  it('is an instanceof Error with name BoardApiError', () => {
    const err = makeError(500, 'unknown_error');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BoardApiError');
  });
});

describe('type guards', () => {
  it('isNotFound matches only 404 BoardApiError instances', () => {
    expect(isNotFound(makeError(404, 'boards_not_found'))).toBe(true);
    expect(isNotFound(makeError(401, 'auth_unauthenticated'))).toBe(false);
  });

  it('isUnauthorized matches 401, isForbidden 403, isRateLimited 429, isConflict 409', () => {
    expect(isUnauthorized(makeError(401, 'auth_unauthenticated'))).toBe(true);
    expect(isUnauthorized(makeError(403, 'auth_forbidden'))).toBe(false);
    expect(isForbidden(makeError(403, 'auth_forbidden'))).toBe(true);
    expect(isForbidden(makeError(401, 'auth_unauthenticated'))).toBe(false);
    expect(isRateLimited(makeError(429, 'rate_limited'))).toBe(true);
    expect(isConflict(makeError(409, 'board_auth_email_taken'))).toBe(true);
  });

  it('isBoardPasswordRequired matches the wall code, not a generic 401', () => {
    // Must discriminate the password wall from an expired board-USER token,
    // which is also 401 — callers re-`verify()` for the former, re-login for the
    // latter.
    expect(
      isBoardPasswordRequired(makeError(401, 'board_password_required')),
    ).toBe(true);
    expect(
      isBoardPasswordRequired(makeError(401, 'board_auth_invalid_token')),
    ).toBe(false);
  });

  it('isFreeEmailWebsiteError matches the free-email website code at 422', () => {
    expect(
      isFreeEmailWebsiteError(makeError(422, 'employer_free_email_website')),
    ).toBe(true);
    expect(
      isFreeEmailWebsiteError(makeError(409, 'employer_company_exists')),
    ).toBe(false);
    expect(
      isFreeEmailWebsiteError(makeError(422, 'employer_ats_unprocessable')),
    ).toBe(false);
  });

  it('isValidationError matches the v1 validation code, not other 400s', () => {
    expect(isValidationError(makeError(400, 'validation_bad_request'))).toBe(
      true,
    );
    expect(isValidationError(makeError(400, 'oauth_invalid_grant'))).toBe(
      false,
    );
  });

  it('guards return false for non-BoardApiError values', () => {
    expect(isBoardApiError(new Error('plain'))).toBe(false);
    expect(isBoardApiError(undefined)).toBe(false);
    expect(isNotFound(new Error('plain'))).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
  });

  it('isBoardApiError narrows real instances', () => {
    const err: unknown = makeError(404, 'jobs_not_found');
    expect(isBoardApiError(err)).toBe(true);
  });
});

describe('isBoardApiError structural predicate', () => {
  it('accepts cross-bundle-shaped errors and rejects name-only impostors', () => {
    const foreign = Object.assign(new Error('x'), {
      name: 'BoardApiError',
      status: 404,
      code: 'jobs_not_found',
      raw: {},
    });
    expect(isBoardApiError(foreign)).toBe(true);
    const impostor = Object.assign(new Error('x'), { name: 'BoardApiError' });
    expect(isBoardApiError(impostor)).toBe(false);
  });
});

describe('SSO guards', () => {
  it('isSignInMethodUnavailable matches board_auth_method_unavailable and narrows details', () => {
    const err = new BoardApiError({
      status: 403,
      code: 'board_auth_method_unavailable',
      message: 'This sign-in method is not available',
      details: {
        availableMethods: {
          methods: ['magicLink', 'google'],
          ssoConnectionIds: ['conn_a'],
        },
      },
      raw: {},
    });
    expect(isSignInMethodUnavailable(err)).toBe(true);
    if (isSignInMethodUnavailable(err)) {
      expect(err.details.availableMethods).toEqual({
        methods: ['magicLink', 'google'],
        ssoConnectionIds: ['conn_a'],
      });
    }
    const ssoOnly = new BoardApiError({
      status: 403,
      code: 'board_auth_method_unavailable',
      message: 'x',
      details: { availableMethods: { methods: [], ssoConnectionIds: ['c'] } },
      raw: {},
    });
    expect(isSignInMethodUnavailable(ssoOnly)).toBe(true);
  });

  it('isSignInMethodUnavailable rejects other codes and malformed details', () => {
    const withDetails = (details: unknown) =>
      new BoardApiError({
        status: 403,
        code: 'board_auth_method_unavailable',
        message: 'x',
        details,
        raw: {},
      });
    expect(
      isSignInMethodUnavailable(
        makeError(403, 'board_auth_method_unavailable'),
      ),
    ).toBe(false);
    expect(isSignInMethodUnavailable(withDetails({}))).toBe(false);
    expect(
      isSignInMethodUnavailable(
        withDetails({ availableMethods: { methods: ['password'] } }),
      ),
    ).toBe(false);
    expect(
      isSignInMethodUnavailable(
        withDetails({
          availableMethods: { methods: [1], ssoConnectionIds: [] },
        }),
      ),
    ).toBe(false);
    expect(
      isSignInMethodUnavailable(
        withDetails({
          availableMethods: { methods: [], ssoConnectionIds: [42] },
        }),
      ),
    ).toBe(false);
    expect(isSignInMethodUnavailable(makeError(403, 'auth_forbidden'))).toBe(
      false,
    );
    expect(
      isSignInMethodUnavailable(new Error('board_auth_method_unavailable')),
    ).toBe(false);
  });

  it('isSsoBrowserMismatch matches only the browser-mismatch code', () => {
    expect(
      isSsoBrowserMismatch(makeError(403, 'board_auth_sso_browser_mismatch')),
    ).toBe(true);
    expect(
      isSsoBrowserMismatch(makeError(403, 'board_auth_sso_not_provisioned')),
    ).toBe(false);
  });
});

describe('deprecated isSsoRequired compatibility', () => {
  it('recognizes older responses and the current SSO-only error envelope', () => {
    for (const [code, details] of [
      ['sso_required', { connectionIds: ['conn_1'] }],
      [
        'board_auth_method_unavailable',
        {
          connectionIds: ['conn_1'],
          availableMethods: { methods: [], ssoConnectionIds: ['conn_1'] },
        },
      ],
    ] as const) {
      const error = new BoardApiError({
        status: 403,
        code,
        message: 'SSO only',
        details,
        requestId: 'req_compat',
        raw: null,
      });
      expect(isSsoRequired(error)).toBe(true);
      if (isSsoRequired(error))
        expect(error.details.connectionIds).toEqual(['conn_1']);
    }
    expect(isSsoRequired(makeError(403, 'board_auth_method_unavailable'))).toBe(
      false,
    );
  });
});
