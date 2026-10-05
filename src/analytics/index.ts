/**
 * `@cavuno/board/analytics` — client write surface for board analytics.
 *
 * Emits pageviews (via hosted script) and custom events to Cavuno collect.
 * Uses the board publishable key only; no second analytics credential.
 */

import {
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  PENDING_TENANT_ID,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
  WELL_KNOWN_SCRIPT_PATH,
} from './defaults';
import {
  WELL_KNOWN_COLLECT_EVENTS_PATH,
  matchAnalyticsWellKnown,
} from './well-known';

export {
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  PENDING_TENANT_ID,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
} from './defaults';

export {
  WELL_KNOWN_COLLECT_EVENTS_PATH,
  matchAnalyticsWellKnown,
} from './well-known';

const GLOBAL_NAME = 'CavunoAnalytics';

export type AnalyticsInstallOptions = {
  publishableKey: string;
  /** Default: Cavuno central collect (self-host safe) */
  collectUrl?: string;
  /** Default: Cavuno-hosted metrics script */
  scriptUrl?: string;
};

type InstalledState = {
  publishableKey: string;
  collectUrl: string;
};

type CavunoAnalyticsGlobal = {
  trackEvent: (action: string, payload?: Record<string, unknown>) => void;
};

type AnalyticsRoot = typeof globalThis & {
  [GLOBAL_NAME]?: CavunoAnalyticsGlobal;
  document?: {
    createElement: (tag: string) => {
      defer: boolean;
      src: string;
      dataset: Record<string, string>;
      setAttribute: (name: string, value: string) => void;
    };
    head?: { appendChild: (node: unknown) => void };
    getElementsByTagName: (tag: string) => ArrayLike<{
      parentNode?: { insertBefore: (a: unknown, b: unknown) => void };
    }>;
    querySelector: (selector: string) => unknown;
    location?: { hostname?: string; origin?: string };
  };
};

let installed: InstalledState | null = null;

function getRoot(): AnalyticsRoot {
  return globalThis as AnalyticsRoot;
}

function normalizeCollectUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveDefaultCollectUrl(): string {
  // Central collect is the self-host default (no Worker / well-known required).
  // Callers with first-party handlers pass WELL_KNOWN_COLLECT_PATH explicitly.
  return DEFAULT_COLLECT_URL;
}

function resolveDefaultScriptUrl(): string {
  return DEFAULT_SCRIPT_URL;
}

function postCollectJson(
  state: InstalledState,
  action: string,
  payload?: Record<string, unknown>,
): void {
  const body = JSON.stringify({
    publishableKey: state.publishableKey,
    action,
    payload: payload ?? {},
  });

  void fetch(state.collectUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.publishableKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Beacon failures must not break the host page.
  });
}

function exposeGlobal(state: InstalledState): void {
  const root = getRoot();
  root[GLOBAL_NAME] = {
    trackEvent(action, payload) {
      postCollectJson(state, action, payload);
    },
  };
}

function injectScript(state: InstalledState, scriptUrl: string): void {
  const doc = getRoot().document;
  if (!doc?.createElement) {
    return;
  }

  if (doc.querySelector?.(`script[data-cavuno-analytics="1"]`)) {
    return;
  }

  const el = doc.createElement('script');
  el.defer = true;
  el.src = scriptUrl;
  el.setAttribute('data-cavuno-analytics', '1');
  el.setAttribute('data-token', state.publishableKey);
  // Metrics script posts events to `${data-host}/v0/events`.
  el.setAttribute('data-host', state.collectUrl);
  el.setAttribute('data-tenant-id', PENDING_TENANT_ID);
  el.setAttribute('data-web-vitals', 'true');

  const head = doc.head;
  if (head?.appendChild) {
    head.appendChild(el);
    return;
  }

  const first = doc.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(el, first);
}

/**
 * Load the Cavuno-hosted metrics script and remember collect credentials.
 * Safe to call once per page; subsequent calls update collect targets only.
 *
 * The script sets a first-party `session-id` cookie (a random identifier
 * that expires after 30 minutes without activity) and sends page view,
 * engagement, and web-vital events. Where your board requires cookie consent
 * (`analytics.cookieConsentRequired` from `board.context()`), call `install`
 * only after the visitor accepts. Until it runs, `track` sends nothing.
 */
export function install(options: AnalyticsInstallOptions): void {
  const publishableKey = options.publishableKey.trim();
  if (!publishableKey.startsWith('pk_')) {
    throw new Error('analytics.install requires a publishable key (pk_…)');
  }

  const collectUrl = normalizeCollectUrl(
    (options.collectUrl ?? resolveDefaultCollectUrl()).trim() ||
      resolveDefaultCollectUrl(),
  );
  const scriptUrl =
    (options.scriptUrl ?? resolveDefaultScriptUrl()).trim() ||
    resolveDefaultScriptUrl();

  installed = { publishableKey, collectUrl };
  exposeGlobal(installed);
  injectScript(installed, scriptUrl);
}

/**
 * Emit a custom analytics event to Cavuno collect.
 * Prefer `install` first so pageviews and vitals are also recorded.
 */
export function track(action: string, payload?: Record<string, unknown>): void {
  const trimmed = action.trim();
  if (!trimmed) {
    return;
  }

  const root = getRoot();
  const globalTrack = root[GLOBAL_NAME]?.trackEvent;
  if (typeof globalTrack === 'function' && installed) {
    globalTrack(trimmed, payload);
    return;
  }

  if (!installed) {
    return;
  }

  postCollectJson(installed, trimmed, payload);
}

/** A visitor's answer to the cookie banner, as recorded by `recordConsent`. */
export type ConsentChoice = 'accepted' | 'denied' | 'withdrawn';

export type RecordConsentInput = {
  /** The board's publishable key (`pk_…`), the same one `install` takes. */
  publishableKey: string;
  /**
   * Random UUID the banner generates once and keeps in its own consent
   * cookie, so every choice from the same browser shares one id.
   */
  consentId: string;
  choice: ConsentChoice;
  /** Identifies the banner text the visitor saw. 1–128 characters. */
  bannerVersion: string;
  /** Default: Cavuno central collect, as for `install`. */
  collectUrl?: string;
};

const CONSENT_CHOICES: readonly ConsentChoice[] = [
  'accepted',
  'denied',
  'withdrawn',
];
const CONSENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BANNER_VERSION_MAX_LENGTH = 128;

/**
 * Record a cookie-banner choice as proof of consent. Call it on every
 * Accept, Decline and withdrawal.
 *
 * Works without `install`, so a Decline is recorded even though analytics
 * never load. It reads and sets no cookie and sends no session id: the
 * record holds only the consent id, the choice, the banner version, the
 * board and the time it was received.
 *
 * Sends `POST {collectUrl}` with
 * `{ publishableKey, action: 'consent', payload: { consent_id, choice, banner_version } }`.
 * Throws on invalid input; network failures are swallowed.
 */
export function recordConsent(input: RecordConsentInput): void {
  const publishableKey = input.publishableKey.trim();
  if (!publishableKey.startsWith('pk_')) {
    throw new Error(
      'analytics.recordConsent requires a publishable key (pk_…)',
    );
  }
  const consentId = input.consentId.trim().toLowerCase();
  if (!CONSENT_ID_PATTERN.test(consentId)) {
    throw new Error('analytics.recordConsent requires a UUID consentId');
  }
  if (!CONSENT_CHOICES.includes(input.choice)) {
    throw new Error(
      "analytics.recordConsent choice must be 'accepted', 'denied' or 'withdrawn'",
    );
  }
  const bannerVersion = input.bannerVersion.trim();
  if (
    bannerVersion.length === 0 ||
    bannerVersion.length > BANNER_VERSION_MAX_LENGTH
  ) {
    throw new Error(
      'analytics.recordConsent requires a bannerVersion of 1–128 characters',
    );
  }
  const collectUrl = normalizeCollectUrl(
    (input.collectUrl ?? resolveDefaultCollectUrl()).trim() ||
      resolveDefaultCollectUrl(),
  );

  void fetch(collectUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      publishableKey,
      action: 'consent',
      payload: {
        consent_id: consentId,
        choice: input.choice,
        banner_version: bannerVersion,
      },
    }),
    // A consent record must not travel with cookies, first-party or not.
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {
    // Beacon failures must not break the host page.
  });
}

export const analytics = {
  install,
  track,
  recordConsent,
  matchAnalyticsWellKnown,
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  PENDING_TENANT_ID,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
  WELL_KNOWN_COLLECT_EVENTS_PATH,
};
