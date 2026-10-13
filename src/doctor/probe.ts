/**
 * The shared GET-with-timeout probe used by the tier-1 (run.ts) and
 * tier-2 (read.ts) checks. One copy so timeout/error-shape behavior
 * can't drift between the two tiers. (writes.ts has its own
 * POST-capable `request`; this is the read-only shape.)
 */
/** Cold candidate child sitemaps are a ~30s first isolate (Cybersecurity 2026-08-25). */
export const FETCH_TIMEOUT_MS = 60_000;

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

/** One hop, redirects not followed: the status and `Location` as sent. */
export async function probeHop(
  fetchImpl: typeof fetch,
  url: string,
): Promise<{ status: number; location: string | null; error?: string }> {
  try {
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    // Only the status line and headers matter; release the body.
    await response.body?.cancel().catch(() => undefined);
    return {
      status: response.status,
      location: response.headers.get('location'),
    };
  } catch (error) {
    return {
      status: 0,
      location: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
