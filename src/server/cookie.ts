/**
 * Shared cookie primitives for the `/server` codecs — ONE copy of the
 * security-relevant attribute string and the header-scan logic, so the
 * session and grant codecs cannot silently diverge (the exact drift mode
 * this layer exists to kill).
 */

/** `__Host-` prefix requirements: Path=/, Secure, no Domain. */
export const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export function buildCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; ${COOKIE_ATTRIBUTES}`;
}

export function buildClearCookie(name: string): string {
  return `${name}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}

/** Extract one cookie's decoded value from a `Cookie` header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  const raw = pair.slice(name.length + 1);
  if (!raw) return null;
  // The value is a client-controlled header: a malformed percent-escape
  // ("%", truncated multi-byte) makes decodeURIComponent throw URIError.
  // The codec contract is malformed → null (signed out), never a crash.
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
export { scopeToken as cookieScope } from '../scope';
