/**
 * The shared GET-with-timeout probe used by the tier-1 (run.ts) and
 * tier-2 (read.ts) checks. One copy so timeout/error-shape behavior
 * can't drift between the two tiers. (writes.ts has its own
 * POST-capable `request`; this is the read-only shape.)
 */
export const FETCH_TIMEOUT_MS = 10_000;

export async function probe(
  fetchImpl: typeof fetch,
  url: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}
