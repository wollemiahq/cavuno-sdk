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
    | 'template_illegal_charset';
  message: string;
  role?: string;
  token?: string;
};

export type ValidateManifestResult =
  | { ok: true; manifest: ManifestV1 }
  | { ok: false; errors: ValidateManifestError[] };
