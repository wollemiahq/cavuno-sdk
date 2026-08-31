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

export const analytics = {
  install,
  track,
  matchAnalyticsWellKnown,
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  PENDING_TENANT_ID,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
  WELL_KNOWN_COLLECT_EVENTS_PATH,
};
