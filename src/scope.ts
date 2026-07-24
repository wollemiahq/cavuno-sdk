/**
 * Collision-safe scope token from a board identifier — shared by the cookie
 * codecs and the browser storage modes (ONE copy to harden). Sanitizing
 * alone collides ('acme.jobs' vs 'acme_jobs' → 'acme_jobs'); the djb2 hash
 * of the RAW identifier keeps distinct boards distinct.
 */
export function scopeToken(board: string): string {
  let hash = 5381;
  for (let i = 0; i < board.length; i++) {
    hash = ((hash << 5) + hash + board.charCodeAt(i)) >>> 0;
  }
  const sanitized = board.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}-${hash.toString(36)}`;
}
