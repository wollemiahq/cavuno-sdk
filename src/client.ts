import { BoardApiError } from './errors';
import { toSearchParams } from './query';
import {
  ACCESS_TOKEN_KEY,
  BOARD_ACCESS_GRANT_KEY,
  type Awaitable,
  type CustomStorage,
} from './storage';
import { SDK_VERSION } from './version';

/**
 * The request handed to `onRequest` and `fetch`. `onRequest` may
 * mutate or replace it wholesale (locale headers, URL rewrites);
 * whatever it returns is what gets fetched.
 */
export interface BoardRequest {
  /** Fully built URL, query string included. */
  url: string;
  /** Final RequestInit: method, Headers instance, serialized body, plus passthrough keys (`signal`, `cache`, `next`, `cf`, …). */
  init: RequestInit;
}

export interface Logger {
  debug(message: string): void;
  error(message: string): void;
}

/**
 * Per-call options on every SDK method. Everything besides `body` and
 * `query` is passed through to `fetch` untouched, so framework caching
 * (`next: { tags }`, `cf: {...}`, `cache:`) rides for free.
 */
export type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  query?: Record<string, unknown>;
};

export interface BoardClientOptions {
  baseUrl: string;
  /** Board identifier: `pk_…` key | `boards_…` ID | slug. */
  board: string;
  storage: CustomStorage;
  globalHeaders?: Record<string, string>;
  onRequest?: (req: BoardRequest) => Awaitable<BoardRequest>;
  onResponse?: (res: Response, req: BoardRequest) => Awaitable<void>;
  logger?: Logger;
}

function isRawBody(body: unknown): boolean {
  return (
    typeof body === 'string' ||
    body instanceof URLSearchParams ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    body instanceof ArrayBuffer ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  );
}

/**
 * Keep logger output useful without copying user data or one-time tokens from
 * query strings into application logs. Query parameter names remain visible
 * for diagnostics; every value is redacted because new sensitive parameters
 * must be safe by default without maintaining a denylist.
 */
export function redactUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    for (const key of new Set(url.searchParams.keys())) {
      url.searchParams.delete(key);
      url.searchParams.set(key, '[REDACTED]');
    }
    return url.toString();
  } catch {
    return value.replace(/([?&][^=&#]+)=([^&#]*)/g, '$1=[REDACTED]');
  }
}

export class BoardClient {
  readonly storage: CustomStorage;
  private readonly basePath: string;
  private readonly options: BoardClientOptions;

  constructor(options: BoardClientOptions) {
    this.options = options;
    this.storage = options.storage;
    const baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.basePath = `${baseUrl}/v1/boards/${encodeURIComponent(options.board)}`;
  }

  /**
   * The full request pipeline. Public and first-class: custom endpoints
   * work without an SDK release, and still get the board-identifier
   * base path, default headers, bearer token, and both hooks.
   *
   * @example
   * const stats = await board.client.fetch<MyShape>('/custom/stats');
   */
  async fetch<T>(path: string, init: FetchOptions = {}): Promise<T> {
    const { body, query, headers: callHeaders, ...passthrough } = init;
    const method = (init.method ?? 'GET').toUpperCase();

    let url = `${this.basePath}${path}`;
    const params = toSearchParams(query);
    const search = params.toString();
    if (search) url += `?${search}`;

    const jsonBody = body !== undefined && !isRawBody(body);
    const serializedBody =
      body === undefined
        ? undefined
        : jsonBody
          ? JSON.stringify(body)
          : (body as BodyInit);

    // Merge order — later set() wins: defaults → globalHeaders → token
    // → per-call. Always via Headers iteration; never object spread
    // (spreading a Headers instance silently yields {}).
    const headers = new Headers({ accept: 'application/json' });
    if (jsonBody) headers.set('content-type', 'application/json');
    for (const [key, value] of Object.entries(
      this.options.globalHeaders ?? {},
    )) {
      headers.set(key, value);
    }
    const token = await this.storage.getItem(ACCESS_TOKEN_KEY);
    if (token !== null) headers.set('authorization', `Bearer ${token}`);
    // The board-password grant rides as `X-Board-Access` on every read once
    // `password.verify()` has stored it; a per-call header (the SSR pattern)
    // overrides it.
    const grant = await this.storage.getItem(BOARD_ACCESS_GRANT_KEY);
    if (grant !== null) headers.set('x-board-access', grant);
    if (callHeaders) {
      new Headers(callHeaders as HeadersInit).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    // Preflight-preserving rule: the SDK header rides only on requests
    // that already trigger a CORS preflight (non-GET, or Authorization
    // attached) so bare anonymous GETs stay CORS-simple. Evaluated on
    // the merged result so the per-call SSR authorization pattern
    // counts; never overwrites an explicit value.
    if (
      (method !== 'GET' ||
        headers.has('authorization') ||
        headers.has('x-board-access')) &&
      !headers.has('x-cavuno-sdk')
    ) {
      headers.set('x-cavuno-sdk', `board@${SDK_VERSION}`);
    }

    let req: BoardRequest = {
      url,
      init: { ...passthrough, method, headers, body: serializedBody },
    };
    if (this.options.onRequest) req = await this.options.onRequest(req);

    const logUrl = redactUrlForLog(req.url);
    this.options.logger?.debug(`${method} ${logUrl}`);
    const res = await globalThis.fetch(req.url, req.init);
    this.options.logger?.debug(`${res.status} ${method} ${logUrl}`);

    // The hook gets a clone so it may read the body (the natural use on
    // error statuses) without starving the client's own parse below.
    if (this.options.onResponse)
      await this.options.onResponse(res.clone(), req);

    if (res.status === 204) return undefined as T;
    if (res.ok) return (await res.json()) as T;

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    const envelope = (
      parsed as { error?: { code?: unknown; message?: unknown } } | undefined
    )?.error;
    const error =
      envelope &&
      typeof envelope.code === 'string' &&
      typeof envelope.message === 'string'
        ? new BoardApiError({
            status: res.status,
            code: envelope.code,
            message: envelope.message,
            details: (envelope as { details?: unknown }).details,
            requestId: (envelope as { requestId?: string }).requestId,
            raw: parsed,
          })
        : new BoardApiError({
            status: res.status,
            code: 'unknown_error',
            message: res.statusText || 'Request failed',
            raw: parsed,
          });
    this.options.logger?.error(
      `${error.status} ${error.code} ${method} ${logUrl}`,
    );
    throw error;
  }
}
