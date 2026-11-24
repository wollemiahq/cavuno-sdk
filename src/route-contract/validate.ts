import { ALL_FEATURES, isRouteFeature, type RouteFeature } from './features';
import { extractParamNames } from './params';
import { isRouteRole, ROLE_PARAM_REGISTRY, type RouteRole } from './roles';

import type {
  ManifestV1,
  ValidateManifestError,
  ValidateManifestResult,
} from './types';

/**
 * Path-template charset after structural checks (//, ?#, segments).
 * `@` allows fixed text such as `/@:handle` around a param.
 */
const TEMPLATE_CHARSET_RE = /^[A-Za-z0-9/_.:@-]+$/;

/**
 * Roles whose template must carry fixed text besides the params. A profile
 * address that is only `/:handle` would collide with every board page
 * (`/jobs`, `/about`) and lose to any page added later.
 */
const FIXED_TEXT_ROLES: ReadonlySet<RouteRole> = new Set(['talentProfile']);

/**
 * Per-role template checks shared by validateManifest and compileManifest.
 * Never throws — returns zero or more typed errors.
 *
 * Rules (v1):
 * - non-empty string
 * - must start with '/' but NOT '//'; no '//' anywhere
 * - no '.' or '..' path segments
 * - no '?', '#', or whitespace
 * - charset limited to [A-Za-z0-9\-_/:.@]
 * - params referenced by a template must be in ROLE_PARAM_REGISTRY[role]
 * - static / empty-registry roles must have zero `:` tokens
 * - parameterized roles must retain at least one registry param
 * - `talentProfile` must carry fixed text around its param (not `/:handle`)
 */
export function checkRoleTemplate(
  role: RouteRole,
  template: string,
): ValidateManifestError[] {
  const errors: ValidateManifestError[] = [];

  if (typeof template !== 'string' || template.length === 0) {
    errors.push({
      code: 'invalid_template',
      message: `role '${role}' template must be a non-empty string`,
      role,
    });
    return errors;
  }

  if (!template.startsWith('/')) {
    errors.push({
      code: 'invalid_template',
      message: `role '${role}' template must start with '/', got ${JSON.stringify(template)}`,
      role,
    });
    return errors;
  }

  if (/\s/.test(template)) {
    errors.push({
      code: 'invalid_template',
      message: `role '${role}' template must not contain whitespace, got ${JSON.stringify(template)}`,
      role,
    });
    return errors;
  }

  // Query/fragment before '//' so templates like `/x?y=//evil` get the
  // more specific query_or_fragment code (still rejected either way).
  if (template.includes('?') || template.includes('#')) {
    errors.push({
      code: 'template_query_or_fragment',
      message: `role '${role}' template must not contain '?' or '#', got ${JSON.stringify(template)}`,
      role,
    });
    return errors;
  }

  if (template.startsWith('//') || template.includes('//')) {
    errors.push({
      code: 'template_double_slash',
      message: `role '${role}' template must not contain '//', got ${JSON.stringify(template)}`,
      role,
    });
    return errors;
  }

  // Reject '.' / '..' as path segments (literal segments only).
  for (const seg of template.split('/')) {
    if (seg === '.' || seg === '..') {
      errors.push({
        code: 'template_dot_segment',
        message: `role '${role}' template must not contain '.' or '..' segments, got ${JSON.stringify(template)}`,
        role,
      });
      return errors;
    }
  }

  if (!TEMPLATE_CHARSET_RE.test(template)) {
    errors.push({
      code: 'template_illegal_charset',
      message: `role '${role}' template contains illegal characters, got ${JSON.stringify(template)}`,
      role,
    });
    return errors;
  }

  const registry = ROLE_PARAM_REGISTRY[role];
  const tokens = extractParamNames(template);

  if (registry.length === 0) {
    if (tokens.length > 0) {
      errors.push({
        code: 'static_has_params',
        message: `static role '${role}' template must not contain ':' tokens, got ${template}`,
        role,
        token: tokens[0],
      });
    }
  } else {
    const registrySet = new Set(registry);
    for (const token of tokens) {
      if (!registrySet.has(token)) {
        errors.push({
          code: 'unregistered_param',
          message: `role '${role}' template references unregistered param ':${token}'`,
          role,
          token,
        });
      }
    }

    const retained = tokens.filter((t) => registrySet.has(t));
    if (retained.length === 0) {
      errors.push({
        code: 'missing_entity_param',
        message: `role '${role}' template must contain at least one registry param (${registry.join(', ')})`,
        role,
      });
    }

    if (FIXED_TEXT_ROLES.has(role) && isParamsOnly(template)) {
      errors.push({
        code: 'invalid_template',
        message: `role '${role}' template must carry fixed text around its params (e.g. '/p/:handle' or '/@:handle'), got ${JSON.stringify(template)}`,
        role,
      });
    }
  }

  return errors;
}

/** True when nothing but `:param` tokens and slashes makes up the template. */
function isParamsOnly(template: string): boolean {
  return (
    template.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '').replace(/\//g, '')
      .length === 0
  );
}

/** A path segment of a base path: the template charset without `:`. */
const BASE_PATH_SEGMENT_RE = /^[A-Za-z0-9_.@-]+$/;

/**
 * `basePath` checks: a path from the domain root with one or more plain
 * segments and no trailing slash (`/jobboard`, `/en/jobs`). `/` is the
 * domain root, the same as leaving it out.
 */
function checkBasePath(value: unknown): ValidateManifestError[] {
  const invalid = (reason: string): ValidateManifestError[] => [
    {
      code: 'invalid_base_path',
      message: `basePath ${reason}, got ${JSON.stringify(value)}`,
    },
  ];
  if (typeof value !== 'string') return invalid('must be a string');
  if (value === '/') return [];
  if (!value.startsWith('/')) return invalid("must start with '/'");
  if (value.endsWith('/')) return invalid("must not end with '/'");
  const segments = value.slice(1).split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      return invalid("must not contain empty, '.' or '..' segments");
    }
    if (!BASE_PATH_SEGMENT_RE.test(segment)) {
      return invalid('may only contain letters, digits and - _ . @');
    }
  }
  return [];
}

/** At most this many `languages`, so a manifest can't grow without bound. */
const MAX_LANGUAGES = 20;

/** A language code: the primary subtag, lowercase (`de`, `fil`). */
const LANGUAGE_CODE_RE = /^[a-z]{2,3}$/;

/**
 * `languages` checks: 1 to MAX_LANGUAGES distinct language codes. Region
 * and script subtags are not codes here: `pt-BR` serves as `pt`.
 */
function checkLanguages(value: unknown): ValidateManifestError[] {
  const invalid = (reason: string): ValidateManifestError[] => [
    {
      code: 'invalid_languages',
      message: `languages ${reason}, got ${JSON.stringify(value)}`,
    },
  ];
  if (!Array.isArray(value)) return invalid('must be an array');
  if (value.length === 0 || value.length > MAX_LANGUAGES) {
    return invalid(`must list 1 to ${MAX_LANGUAGES} languages`);
  }
  if (
    value.some(
      (code) => typeof code !== 'string' || !LANGUAGE_CODE_RE.test(code),
    )
  ) {
    return invalid('must be lowercase language codes such as "de"');
  }
  if (new Set(value).size !== value.length) {
    return invalid('must not list a language twice');
  }
  return [];
}

/**
 * Structural + registry validation of an unknown value as ManifestV1.
 * Never throws — returns typed errors.
 */
export function validateManifest(value: unknown): ValidateManifestResult {
  const errors: ValidateManifestError[] = [];

  if (value === null || typeof value !== 'object') {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid_shape',
          message: 'manifest must be an object',
        },
      ],
    };
  }

  const record = value as Record<string, unknown>;

  if (record.version !== 1) {
    errors.push({
      code: 'invalid_version',
      message: `manifest version must be 1, got ${JSON.stringify(record.version)}`,
    });
  }

  if (
    record.roles === null ||
    typeof record.roles !== 'object' ||
    Array.isArray(record.roles)
  ) {
    errors.push({
      code: 'invalid_shape',
      message: 'manifest.roles must be an object',
    });
    return { ok: false, errors };
  }

  const rolesIn = record.roles as Record<string, unknown>;
  const rolesOut: ManifestV1['roles'] = {};

  for (const [key, template] of Object.entries(rolesIn)) {
    if (!isRouteRole(key)) {
      errors.push({
        code: 'unknown_role',
        message: `unknown role '${key}'`,
        role: key,
      });
      continue;
    }

    if (typeof template !== 'string') {
      errors.push({
        code: 'invalid_template',
        message: `role '${key}' template must be a non-empty string`,
        role: key,
      });
      continue;
    }

    const role: RouteRole = key;
    const roleErrors = checkRoleTemplate(role, template);
    if (roleErrors.length > 0) {
      errors.push(...roleErrors);
      continue;
    }

    rolesOut[role] = template;
  }

  let featuresOut: RouteFeature[] = [];
  if (record.features !== undefined) {
    if (!Array.isArray(record.features)) {
      errors.push({
        code: 'invalid_shape',
        message: 'manifest.features must be an array',
      });
    } else {
      // Unknown names are dropped, not refused: a site built on a newer SDK
      // may declare a feature this one does not know yet, and refusing it
      // would discard the site's roles with it.
      const known = new Set<RouteFeature>();
      for (const name of record.features as unknown[]) {
        if (typeof name === 'string' && isRouteFeature(name)) known.add(name);
      }
      featuresOut = ALL_FEATURES.filter((feature) => known.has(feature));
    }
  }

  const basePath = record.basePath;
  if (basePath !== undefined) errors.push(...checkBasePath(basePath));
  const languages = record.languages;
  if (languages !== undefined) errors.push(...checkLanguages(languages));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: ManifestV1 = { version: 1, roles: rolesOut };
  if (featuresOut.length > 0) {
    manifest.features = featuresOut;
  }
  if (typeof basePath === 'string' && basePath !== '/') {
    manifest.basePath = basePath;
  }
  if (Array.isArray(languages)) {
    manifest.languages = languages.map(String);
  }
  return { ok: true, manifest };
}
