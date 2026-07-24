import { extractParamNames } from './params';
import { isRouteRole, ROLE_PARAM_REGISTRY, type RouteRole } from './roles';

import type {
  ManifestV1,
  ValidateManifestError,
  ValidateManifestResult,
} from './types';

/** Path-template charset after structural checks (//, ?#, segments). */
const TEMPLATE_CHARSET_RE = /^[A-Za-z0-9/_.:-]+$/;

/**
 * Per-role template checks shared by validateManifest and compileManifest.
 * Never throws — returns zero or more typed errors.
 *
 * Rules (v1):
 * - non-empty string
 * - must start with '/' but NOT '//'; no '//' anywhere
 * - no '.' or '..' path segments
 * - no '?', '#', or whitespace
 * - charset limited to [A-Za-z0-9\-_/:.]
 * - params referenced by a template must be in ROLE_PARAM_REGISTRY[role]
 * - static / empty-registry roles must have zero `:` tokens
 * - parameterized roles must retain at least one registry param
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
  }

  return errors;
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

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    manifest: { version: 1, roles: rolesOut },
  };
}
