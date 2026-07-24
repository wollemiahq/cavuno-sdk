/**
 * Extract `:param` token names from a URLPattern-style template string.
 * Order-insensitive consumers should sort / set-compare the result.
 */
export function extractParamNames(template: string): string[] {
  const names: string[] = [];
  const re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    const name = match[1];
    if (name !== undefined) names.push(name);
  }
  return names;
}

/** Order-insensitive equality of two param-name lists. */
export function sameParamSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

/** Stable key for grouping roles / routes by param signature. */
export function paramSetKey(params: readonly string[]): string {
  return [...params].sort().join('\0');
}
