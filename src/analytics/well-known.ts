/**
 * Optional first-party well-known handlers for board origin Workers.
 * Central collect remains the default when these paths are not mounted.
 */

import {
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
} from './defaults';

export {
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
} from './defaults';

export const WELL_KNOWN_COLLECT_EVENTS_PATH =
  '/.well-known/cavuno/collect/v0/events';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsPreflight(): Response {
  return withCors(new Response(null, { status: 204 }));
}

async function proxyCollect(
  request: Request,
  targetUrl: string,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return corsPreflight();
  }
  if (request.method !== 'POST') {
    return withCors(new Response(null, { status: 405 }));
  }

  const headers = new Headers();
  const authorization = request.headers.get('Authorization');
  const contentType = request.headers.get('Content-Type');
  const accept = request.headers.get('Accept');
  if (authorization) headers.set('Authorization', authorization);
  if (contentType) headers.set('Content-Type', contentType);
  if (accept) headers.set('Accept', accept);

  const body = await request.arrayBuffer();
  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body,
  });

  return withCors(
    new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/json',
      },
    }),
  );
}

/**
 * Handle `/.well-known/cavuno/{analytics.js,collect}` when mounted on a Worker.
 * Returns null for every other path so the host can fall through.
 */
export async function matchAnalyticsWellKnown(
  request: Request,
): Promise<Response | null> {
  const path = stripTrailingSlash(new URL(request.url).pathname);

  if (path === WELL_KNOWN_ANALYTICS_SCRIPT_PATH) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 });
    }
    return Response.redirect(DEFAULT_SCRIPT_URL, 302);
  }

  if (path === WELL_KNOWN_COLLECT_PATH) {
    return proxyCollect(request, DEFAULT_COLLECT_URL);
  }

  if (path === WELL_KNOWN_COLLECT_EVENTS_PATH) {
    return proxyCollect(request, `${DEFAULT_COLLECT_URL}/v0/events`);
  }

  return null;
}
