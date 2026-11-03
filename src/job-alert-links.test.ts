import { describe, expect, it } from 'vitest';

import {
  parseJobAlertClickParams,
  parseJobAlertUnsubscribeParams,
} from './index';

const ALERT = 'k57d2x1tq8m3ffhr4y6v9b0n7s7tqa12';
const EMAIL = '0123456789abcdef';
const JOB_LINK =
  'https://jobs.example.com/jobs/robotics-engineer?utm_source=job_alert' +
  `&utm_medium=email&utm_campaign=filters&ja_alert=${ALERT}` +
  `&ja_email=${EMAIL}&ja_pos=3&ja_mv=alert-exact-v1`;

describe('parseJobAlertClickParams', () => {
  it('reads a digest job link as a string, URL, path or search params', () => {
    const expected = {
      alertId: ALERT,
      emailId: EMAIL,
      position: 3,
      matcherVersion: 'alert-exact-v1',
    };
    expect(parseJobAlertClickParams(JOB_LINK)).toEqual(expected);
    expect(parseJobAlertClickParams(new URL(JOB_LINK))).toEqual(expected);
    expect(
      parseJobAlertClickParams(
        new URL(JOB_LINK).pathname + new URL(JOB_LINK).search,
      ),
    ).toEqual(expected);
    expect(parseJobAlertClickParams(new URL(JOB_LINK).searchParams)).toEqual(
      expected,
    );
    const query = new URL(JOB_LINK).search;
    expect(parseJobAlertClickParams(query)).toEqual(expected);
    expect(parseJobAlertClickParams(query.slice(1))).toEqual(expected);
  });

  it('is null, never a throw, for a malformed URL', () => {
    expect(parseJobAlertClickParams('http://[bad')).toBeNull();
  });

  it('is null for a page without digest params', () => {
    expect(
      parseJobAlertClickParams(
        'https://jobs.example.com/jobs/robotics-engineer',
      ),
    ).toBeNull();
  });

  it.each([
    ['ja_pos', '0'],
    ['ja_pos', '101'],
    ['ja_pos', '02'],
    ['ja_pos', '1.5'],
    ['ja_email', '0123456789ABCDEF'],
    ['ja_email', '0123'],
    ['ja_alert', 'not-an-id'],
    ['ja_mv', 'Alert Exact'],
    ['ja_mv', ''],
  ])('is null when %s is %j', (name, value) => {
    const link = new URL(JOB_LINK);
    link.searchParams.set(name, value);
    expect(parseJobAlertClickParams(link)).toBeNull();
  });
});

describe('parseJobAlertUnsubscribeParams', () => {
  it('reads the alert and email of a manage link', () => {
    expect(
      parseJobAlertUnsubscribeParams(
        `/alerts/manage?subscription=bu_1&token=t&ja_alert=${ALERT}&ja_email=${EMAIL}`,
      ),
    ).toEqual({ alertId: ALERT, emailId: EMAIL });
  });

  it('is null for an older digest link without them, or a malformed one', () => {
    expect(
      parseJobAlertUnsubscribeParams(
        '/alerts/manage?subscription=bu_1&token=t',
      ),
    ).toBeNull();
    expect(
      parseJobAlertUnsubscribeParams(
        `/alerts/manage?ja_alert=${ALERT}&ja_email=xyz`,
      ),
    ).toBeNull();
  });
});
