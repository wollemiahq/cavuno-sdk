/**
 * Serialize a flat query object to URLSearchParams.
 *
 * v1 convention (`01-conventions.md`): flat params only, arrays as
 * repeated keys (`companyId=a&companyId=b`). `null`/`undefined`
 * entries are skipped entirely.
 */
export function toSearchParams(
  query: Record<string, unknown> | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!query) return params;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}
