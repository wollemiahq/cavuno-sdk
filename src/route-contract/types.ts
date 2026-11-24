import type { RouteFeature } from './features';
import type { RouteRole } from './roles';

/**
 * One discovered route. `template` uses URLPattern `:param` syntax
 * (e.g. `/companies/:companySlug/jobs/:jobSlug`). Callers on other
 * runtimes instantiate matchers; this module only emits strings.
 */
export type RouteEntry = {
  template: string;
  /** Absolute or project-relative source path — keys the marker map. */
  sourcePath?: string;
};

/** Versioned role → template map. Additive schema evolution only. */
export type ManifestV1 = {
  version: 1;
  roles: Partial<Record<RouteRole, string>>;
  /**
   * Behaviours the site supports across its pages, in `ALL_FEATURES` order.
   * Absent when the site declares none.
   */
  features?: RouteFeature[];
  /**
   * Where the board's pages live that `roles` doesn't name, such as
   * `/jobboard` for a board served under a path prefix: a role missing from
   * `roles` resolves to its canonical path under it, and so does every
   * fixed path the platform links to (sign-in email links, checkout
   * returns, `/go/` email links). Templates in `roles` are used as written,
   * from the domain root. Absent means the domain root.
   */
  basePath?: string;
  /**
   * The languages the board's pages are served in, by language code
   * (`de`, `pt`), the default language first, for a site that serves its
   * interface in several: the platform shows the ones besides the board's
   * language as the site's secondary languages. Templates in `roles` are in
   * the default language's words. Absent means the board's language only.
   */
  languages?: string[];
};

export type Ambiguity = {
  role: RouteRole;
  candidates: RouteEntry[];
};

export type ClassifyResult = {
  assignments: Partial<Record<RouteRole, RouteEntry>>;
  ambiguities: Ambiguity[];
  missingRequired: RouteRole[];
};

export type CompileResult = {
  manifest: ManifestV1;
  blockingMissing: RouteRole[];
  warnings: string[];
  ambiguities: Ambiguity[];
};

export type ValidateManifestError = {
  code:
    | 'invalid_shape'
    | 'invalid_version'
    | 'unknown_role'
    | 'unregistered_param'
    | 'missing_entity_param'
    | 'static_has_params'
    | 'invalid_template'
    /** Protocol-relative or double-slash path (open redirect / SSRF shape). */
    | 'template_double_slash'
    /** '.' or '..' path segments. */
    | 'template_dot_segment'
    /** Query string or fragment in a path template. */
    | 'template_query_or_fragment'
    /** Characters outside the allowed path/token charset. */
    | 'template_illegal_charset'
    /** A `basePath` that isn't a plain path without a trailing slash. */
    | 'invalid_base_path'
    /** `languages` that aren't distinct lowercase language codes. */
    | 'invalid_languages';
  message: string;
  role?: string;
  token?: string;
};

export type ValidateManifestResult =
  | { ok: true; manifest: ManifestV1 }
  | { ok: false; errors: ValidateManifestError[] };
