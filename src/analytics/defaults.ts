export const DEFAULT_COLLECT_URL = 'https://cavuno.com/api/analytics/collect';

/**
 * Cavuno-hosted metrics script. The `v` query names the script release, so a
 * new release reaches returning visitors instead of waiting out their browser
 * cache. The unversioned URL keeps serving the current script.
 */
export const DEFAULT_SCRIPT_URL =
  'https://cavuno.com/js/metrics.js?v=1.7.1-cavuno.1';

/** Placeholder tenant; collect rewrites from the publishable key. */
export const PENDING_TENANT_ID = 'boards_pending';

export const WELL_KNOWN_ANALYTICS_SCRIPT_PATH =
  '/.well-known/cavuno/analytics.js';

export const WELL_KNOWN_SCRIPT_PATH = WELL_KNOWN_ANALYTICS_SCRIPT_PATH;

export const WELL_KNOWN_COLLECT_PATH = '/.well-known/cavuno/collect';
