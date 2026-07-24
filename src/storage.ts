import { scopeToken } from './scope';

export type Awaitable<T> = T | Promise<T>;

/**
 * Async token storage. The SDK reads the access token from storage on
 * every request (fresh-token rule); auth methods write/clear the pair.
 */
export interface CustomStorage {
  getItem(key: string): Awaitable<string | null>;
  setItem(key: string, value: string): Awaitable<void>;
  removeItem(key: string): Awaitable<void>;
}

export type StorageMode =
  | 'memory'
  | 'nostore'
  | 'local'
  | 'session'
  | CustomStorage;

export const ACCESS_TOKEN_KEY = 'cavuno_board_access_token';
export const REFRESH_TOKEN_KEY = 'cavuno_board_refresh_token';
/** Board-password access grant — sent as `X-Board-Access` to pass the wall. */
export const BOARD_ACCESS_GRANT_KEY = 'cavuno_board_access_grant';

/** Capability detection on globalThis — never bare `window`. */
function isBrowser(): boolean {
  return typeof globalThis.document !== 'undefined';
}

function memoryStorage(): CustomStorage {
  const backing = new Map<string, string>();
  return {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
    removeItem: (key) => {
      backing.delete(key);
    },
  };
}

/**
 * Web Storage-backed modes — browser-only by definition. The throw happens
 * at RESOLVE time (client creation), not on the first token read, so a
 * misconfigured SSR/Workers instance fails loudly at startup.
 */
function browserStorage(
  mode: 'local' | 'session',
  scope: string | undefined,
): CustomStorage {
  if (!isBrowser()) {
    throw new Error(
      `storage mode '${mode}' is browser-only — use 'nostore' + per-call headers on the server`,
    );
  }
  // Merely READING the accessor throws SecurityError in blocked-storage
  // contexts (Safari ITP in a third-party iframe, sandboxed iframes) — a
  // real path for this SDK's embed surface. Keep the failure loud AND
  // actionable, per this module's contract, instead of an opaque platform
  // exception.
  let backing: Storage;
  try {
    backing =
      mode === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    // Some engines return undefined rather than throwing.
    if (!backing) throw new Error('unavailable');
  } catch {
    throw new Error(
      `storage mode '${mode}' is unavailable in this browsing context ` +
        `(storage access is blocked — e.g. a sandboxed or third-party ` +
        `iframe). Use 'memory', or 'nostore' + per-call headers.`,
    );
  }
  // Board-scoped keys: localStorage/sessionStorage are shared per ORIGIN,
  // and one origin can serve multiple boards — unscoped keys would let one
  // board's login clobber (and leak into) another's (the hosted board
  // scopes its grant cookie per account for exactly this reason).
  const suffix = scope ? `:${scopeToken(scope)}` : '';
  return {
    getItem: (key) => backing.getItem(`${key}${suffix}`),
    setItem: (key, value) => {
      backing.setItem(`${key}${suffix}`, value);
    },
    removeItem: (key) => {
      backing.removeItem(`${key}${suffix}`);
    },
  };
}

/**
 * Brand for the no-op storage, via the GLOBAL symbol registry: `Symbol.for`
 * returns the same symbol in every bundle, so the brand survives the
 * subpath entries each inlining their own copy of this module
 * (`splitting: false`) — object identity does not (the errors.ts
 * cross-bundle lesson, again).
 */
const NOSTORE_BRAND = Symbol.for('@cavuno/board:nostore');

/**
 * True when a storage is the no-op server default — structural (brand
 * check), never object identity, so it holds across bundle copies.
 */
export function isNoStore(storage: CustomStorage): boolean {
  return (
    (storage as unknown as { [key: symbol]: unknown })[NOSTORE_BRAND] === true
  );
}

/**
 * The server-default no-op storage. Server helpers (the session refresher)
 * assert `isNoStore` at construction so a shared client cannot persist one
 * user's tokens into another request's reads.
 */
export const NOSTORE: CustomStorage & { [key: symbol]: unknown } = {
  [NOSTORE_BRAND]: true,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Resolve the `auth.storage` option. Default: `memory` in the browser
 * (login works out of the box), `nostore` on the server (a shared SSR
 * instance stays stateless; pass tokens per-call instead).
 *
 * `local`/`session` persist through `globalThis.localStorage`/
 * `sessionStorage` and are browser-only: off-browser they throw loudly
 * at resolve time (board-sdk.md §Auth).
 */
/**
 * Resolve the `auth.storage` option. `scope` (the client's board identifier)
 * namespaces the persistent browser modes so two boards on one origin never
 * share tokens; `memory` needs no scoping (per-client instance) and custom
 * storages own their scoping.
 */
export function resolveStorage(
  mode: StorageMode | undefined,
  scope?: string,
): CustomStorage {
  const resolved = mode ?? (isBrowser() ? 'memory' : 'nostore');
  if (typeof resolved === 'object') return resolved;
  switch (resolved) {
    case 'memory':
      return memoryStorage();
    case 'nostore':
      return NOSTORE;
    case 'local':
    case 'session':
      return browserStorage(resolved, scope);
    default:
      throw new Error(`Unknown storage mode '${String(resolved)}'`);
  }
}

export async function writeSession(
  storage: CustomStorage,
  session: { accessToken: string; refreshToken: string },
): Promise<void> {
  await storage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  await storage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
}

/**
 * Clear the board-USER auth session (called by `auth.logout`). Intentionally
 * does NOT remove `BOARD_ACCESS_GRANT_KEY`: the board-password grant is
 * board-scoped, not user-scoped — it is `HMAC(accountId:passwordChangedAt)`,
 * identical for every visitor of the board — so logging a user out does not
 * un-enter the board password. The host re-challenges if the password rotates.
 */
export async function clearSession(storage: CustomStorage): Promise<void> {
  await storage.removeItem(ACCESS_TOKEN_KEY);
  await storage.removeItem(REFRESH_TOKEN_KEY);
}
