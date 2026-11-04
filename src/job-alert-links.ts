/**
 * Job alert digest link params, read from the URL a visitor landed on.
 *
 * Every job link in a job alert digest email carries `ja_alert` (the alert),
 * `ja_email` (the digest email), `ja_pos` (the job's 1-based position in the
 * digest) and `ja_mv` (the matcher version that chose the jobs). The digest's
 * manage and unsubscribe links carry `ja_alert` and `ja_email`. These helpers
 * read them with the same rules the API validates, so a hand-edited or
 * truncated link yields `null` instead of a request the API would refuse.
 */

/** The `ja_*` params of a digest job link: `jobAlerts.recordClick` input. */
export type JobAlertClickParams = {
  alertId: string;
  emailId: string;
  position: number;
  matcherVersion: string;
};

/** The `ja_*` params of a digest manage or unsubscribe link. */
export type JobAlertUnsubscribeParams = {
  alertId: string;
  emailId: string;
};

const ID = /^[0-9A-Za-z]{16,64}$/;
const EMAIL_ID = /^[0-9a-f]{16}$/;
const MATCHER_VERSION = /^[a-z0-9-]{1,64}$/;
const POSITION = /^[1-9][0-9]{0,2}$/;
const MAX_POSITION = 100;

function searchParamsOf(url: string | URL | URLSearchParams): URLSearchParams {
  if (url instanceof URLSearchParams) return url;
  if (url instanceof URL) return url.searchParams;
  // A bare query (`ja_alert=…&…`, with or without `?`) is read as one.
  if (url.startsWith('?') || (!url.includes('/') && url.includes('='))) {
    return new URLSearchParams(url);
  }
  try {
    // A path with a query (`/jobs/x?ja_alert=…`) parses against any base.
    return new URL(url, 'https://board.invalid').searchParams;
  } catch {
    // A malformed URL is not a digest link.
    return new URLSearchParams();
  }
}

/**
 * The digest click params of a job page URL, or `null` when the URL is not
 * a digest job link (any param missing or malformed).
 *
 * ```ts no-check
 * const click = parseJobAlertClickParams(request.url);
 * ```
 */
export function parseJobAlertClickParams(
  url: string | URL | URLSearchParams,
): JobAlertClickParams | null {
  const params = searchParamsOf(url);
  const alertId = params.get('ja_alert') ?? '';
  const emailId = params.get('ja_email') ?? '';
  const positionRaw = params.get('ja_pos') ?? '';
  const matcherVersion = params.get('ja_mv') ?? '';
  const position = POSITION.test(positionRaw) ? Number(positionRaw) : NaN;
  if (
    !ID.test(alertId) ||
    !EMAIL_ID.test(emailId) ||
    !MATCHER_VERSION.test(matcherVersion) ||
    !(position >= 1 && position <= MAX_POSITION)
  ) {
    return null;
  }
  return { alertId, emailId, position, matcherVersion };
}

/**
 * The digest a manage or unsubscribe link came from, or `null` when the URL
 * does not carry both ids (a link from an older digest, or a hand-edited
 * one). Spread it into `jobAlerts.unsubscribe`.
 *
 * ```ts no-check
 * const from = parseJobAlertUnsubscribeParams(request.url);
 * ```
 */
export function parseJobAlertUnsubscribeParams(
  url: string | URL | URLSearchParams,
): JobAlertUnsubscribeParams | null {
  const params = searchParamsOf(url);
  const alertId = params.get('ja_alert') ?? '';
  const emailId = params.get('ja_email') ?? '';
  if (!ID.test(alertId) || !EMAIL_ID.test(emailId)) return null;
  return { alertId, emailId };
}
