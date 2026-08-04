/**
 * Canonicalize a board-language tag so common operator typos
 * (`ja_JP` → `ja-JP`) never drop every formatter into an English-arranged
 * fallback at once.
 *
 * Underscores are rewritten to hyphens before `Intl.getCanonicalLocales`
 * (which rejects `_`). Structure alone is not enough: tags like `xx`,
 * `qqq`, and `und` are well-formed BCP-47 but have no CLDR data — every
 * downstream `Intl` constructor would silently fall back to the *host*
 * default (Worker ≠ Node ≠ browser). We require at least one supported
 * locale via `Intl.NumberFormat.supportedLocalesOf`.
 *
 * Returns `null` when the tag is not a valid *and supported* locale —
 * callers should prefer `null` display over inventing English (or the
 * host default).
 */
export function normalizeLocale(language: string): string | null {
  const trimmed = language.trim();
  if (!trimmed) return null;
  try {
    const candidate = trimmed.replace(/_/g, '-');
    const [canonical] = Intl.getCanonicalLocales(candidate);
    if (!canonical) return null;
    // supportedLocalesOf separates "well-formed" from "has locale data".
    // Prefer its resolved tag when present (handles grandfathered → modern).
    const [supported] = Intl.NumberFormat.supportedLocalesOf([canonical]);
    return supported ?? null;
  } catch {
    return null;
  }
}
