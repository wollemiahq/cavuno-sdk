import { scopeToken } from './scope';

/**
 * Helpers for the pages a headless board serves around an OAuth or SSO
 * sign-in: `/auth/oauth-complete` (where the provider round trip lands) and
 * `/auth/sign-in?error=…` (where it lands on failure). Pure and
 * framework-neutral; nothing here performs a request or navigates.
 */

export type SignInRole = 'candidate' | 'employer';

/**
 * `error=` codes a sign-in redirect can land on `/auth/sign-in` with. Google
 * and LinkedIn use the `oauth_*` codes, SSO connections the `sso_*` ones;
 * `role_disabled` comes from either. `method_unavailable` means the method
 * is switched off for the user's role: offer the methods listed in
 * `signIn.<role>` from `board.context()` instead. Kept open like
 * `BoardApiErrorCode`: new codes may ship, so render a generic message for
 * anything unlisted.
 */
export const SIGN_IN_REDIRECT_ERROR_CODES = [
  'oauth_cancelled',
  'oauth_failed',
  'oauth_email_unverified',
  'role_disabled',
  'method_unavailable',
  // Deprecated: retained for boards served by earlier API releases.
  'sso_required',
  'sso_state_invalid',
  'sso_cancelled',
  'sso_failed',
  'sso_connection_unavailable',
  'sso_not_provisioned',
  'sso_email_required',
  'sso_account_disabled',
  'sso_identity_linked_elsewhere',
  'sso_link_proof_rate_limited',
  'sso_development_origin_not_allowed_for_email',
] as const;

export type SignInRedirectErrorCode =
  | (typeof SIGN_IN_REDIRECT_ERROR_CODES)[number]
  | (string & {});

/**
 * What a completion URL asks the page to do.
 *
 * - `token`: exchange it with `board.auth.exchangeOAuth({ token })`.
 * - `link_proof_sent`: the provider did not vouch for the email of an
 *   existing account, so a confirmation email is on its way. Keep the secret established before authorization in this browser and
 *   tell the user to check their inbox.
 * - `link_proof`: the user opened that email. Call
 *   `board.auth.consumeSsoLinkProof` with `linkProof` and the stored binding.
 * - `error`: the sign-in failed with `error` (see
 *   `SIGN_IN_REDIRECT_ERROR_CODES`).
 * - `invalid`: none of the above; show a generic failure.
 *
 * `returnTo` is always a same-origin path (`/` when absent or unsafe), so it
 * is safe to redirect to.
 */
export type OAuthCompletion =
  | {
      kind: 'token';
      token: string;
      /** `google`, `linkedin` or `sso`; `null` when absent. */
      method: string | null;
      role: SignInRole | null;
      returnTo: string;
      /** True when this sign-in created the account. */
      isNewUser: boolean;
    }
  | {
      kind: 'link_proof_sent';
      linkProofBinding: string;
      role: SignInRole | null;
      returnTo: string;
    }
  | {
      kind: 'link_proof';
      linkProof: string;
      role: SignInRole | null;
      returnTo: string;
    }
  | { kind: 'error'; error: SignInRedirectErrorCode; returnTo: string }
  | { kind: 'invalid'; returnTo: string };

function toSearchParams(
  input: URLSearchParams | string | Record<string, string | undefined>,
): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === 'string') {
    const query = input.includes('?') ? input.slice(input.indexOf('?')) : input;
    return new URLSearchParams(query);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) params.set(key, value);
  }
  return params;
}

/**
 * A same-origin path, or `/`. Never a scheme-relative or absolute URL.
 * Control characters are refused because browsers strip tab and newline
 * from URLs, which turns `/\t/evil.example` into `//evil.example`.
 */
function safeReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.includes('://') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/';
  }
  return value;
}

function roleOf(value: string | null): SignInRole | null {
  return value === 'candidate' || value === 'employer' ? value : null;
}

/**
 * Read the query of an `/auth/oauth-complete` (or `/auth/sign-in?error=`)
 * request into one discriminated result. Accepts `URLSearchParams`, a full
 * URL or query string, or a plain record (framework search-param objects).
 *
 * @example
 * const completion = parseOAuthCompletion(new URL(request.url).searchParams);
 * switch (completion.kind) {
 *   case 'token':
 *     await board.auth.exchangeOAuth({ token: completion.token });
 *     return redirect(completion.returnTo);
 *   case 'link_proof_sent':
 *     // Keep the secret established before authorization. Never save URL bindings.
 *     return showCheckYourEmail();
 *   // …
 * }
 */
export function parseOAuthCompletion(
  input: URLSearchParams | string | Record<string, string | undefined>,
): OAuthCompletion {
  const params = toSearchParams(input);
  const get = (key: string) => {
    const value = params.get(key);
    return value && value.length > 0 ? value : null;
  };
  const returnTo = safeReturnTo(get('returnTo'));
  const role = roleOf(get('role'));

  const error = get('error');
  if (error) return { kind: 'error', error, returnTo };

  const linkProof = get('linkProof');
  if (linkProof) return { kind: 'link_proof', linkProof, role, returnTo };

  const linkProofBinding = get('linkProofBinding');
  if (get('status') === 'sso_link_proof_sent' && linkProofBinding) {
    return { kind: 'link_proof_sent', linkProofBinding, role, returnTo };
  }

  const token = get('token');
  if (token) {
    return {
      kind: 'token',
      token,
      method: get('method'),
      role,
      returnTo,
      isNewUser: get('isNew') === '1',
    };
  }

  return { kind: 'invalid', returnTo };
}

/**
 * Browser-secret retention from initiation: ten minutes for authorization
 * plus fifteen minutes for a proof email issued at callback. This does not
 * extend the proof token's own fifteen-minute validity.
 */
export const SSO_LINK_PROOF_BINDING_TTL_MS = 25 * 60 * 1000;

const BINDING_KEY = 'cavuno_board_sso_link_proof_binding';

/** The subset of Web Storage the binding store needs. */
export interface BindingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SsoLinkProofBindingStore {
  /** Establish a random secret in this browser BEFORE requesting authorization. */
  begin(): string;
  /** @deprecated Completion URLs cannot install or replace the initiating browser secret. */
  save(linkProofBinding: string): void;
  /** The stored binding, or `null` when absent or older than 25 minutes from initiation. */
  read(): string | null;
  /** Forget the binding (after the proof is consumed). */
  clear(): void;
}

function defaultStorage(): BindingStorage | null {
  try {
    const storage = (globalThis as { localStorage?: BindingStorage })
      .localStorage;
    return storage ?? null;
  } catch {
    // Reading the accessor throws where storage is blocked.
    return null;
  }
}

/**
 * Where the browser that started an SSO sign-in keeps its link-proof
 * secret before authorization and until the user opens the confirmation email.
 * Uses `localStorage` by default, because the email link usually opens in a
 * new tab (which `sessionStorage` would not share). Scoped per board, expires
 * 25 minutes after initiation to cover authorization and the later proof email.
 * Where storage is unavailable (server rendering, blocked storage), `begin()`
 * refuses before authorization and `read()` returns `null`. The proof token
 * itself remains valid for fifteen minutes after it is issued at callback.
 *
 * @example
 * // Before requesting authorization (the SDK does this automatically):
 * ssoLinkProofBindingStore(boardKey).begin();
 */
export function ssoLinkProofBindingStore(
  board: string,
  options: { storage?: BindingStorage; now?: () => number } = {},
): SsoLinkProofBindingStore {
  const key = `${BINDING_KEY}:${scopeToken(board)}`;
  const now = options.now ?? Date.now;
  const storage = () => options.storage ?? defaultStorage();

  const clear = () => {
    try {
      storage()?.removeItem(key);
    } catch {
      // Blocked storage: nothing was stored.
    }
  };

  return {
    begin() {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
      const binding = Array.from(bytes, (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
      const target = storage();
      if (!target)
        throw new Error(
          'SSO requires browser storage or an explicit browser proof',
        );
      target.setItem(
        key,
        JSON.stringify({
          binding,
          expiresAt: now() + SSO_LINK_PROOF_BINDING_TTL_MS,
        }),
      );
      return binding;
    },
    save(_linkProofBinding) {
      // Compatibility acknowledgment only. Never trust URL-delivered authority.
    },
    read() {
      let raw: string | null = null;
      try {
        raw = storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as {
          binding?: unknown;
          expiresAt?: unknown;
        };
        if (
          typeof parsed.binding === 'string' &&
          typeof parsed.expiresAt === 'number' &&
          parsed.expiresAt > now()
        ) {
          return parsed.binding;
        }
      } catch {
        // Corrupt entry: treat as absent.
      }
      clear();
      return null;
    },
    clear,
  };
}
