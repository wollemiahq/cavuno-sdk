import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearSession,
  resolveStorage,
  writeSession,
} from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveStorage', () => {
  it('memory storage round-trips set/get/remove and is isolated per resolution', async () => {
    const a = resolveStorage('memory');
    const b = resolveStorage('memory');
    await a.setItem('k', 'v');
    expect(await a.getItem('k')).toBe('v');
    expect(await b.getItem('k')).toBeNull();
    await a.removeItem('k');
    expect(await a.getItem('k')).toBeNull();
  });

  it('nostore getItem always returns null and setItem is a no-op', async () => {
    const storage = resolveStorage('nostore');
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBeNull();
    await storage.removeItem('k');
  });

  it('defaults to nostore off-browser', async () => {
    const storage = resolveStorage(undefined);
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('defaults to memory when globalThis.document exists', async () => {
    vi.stubGlobal('document', {});
    const storage = resolveStorage(undefined);
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
  });

  it('throws loudly for an unknown storage mode', () => {
    expect(() => resolveStorage('bogus' as unknown as 'memory')).toThrowError(
      /bogus/,
    );
  });

  it('uses a custom storage object as-is, including async implementations', async () => {
    const backing = new Map<string, string>();
    const custom = {
      getItem: async (key: string) => backing.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        backing.set(key, value);
      },
      removeItem: async (key: string) => {
        backing.delete(key);
      },
    };
    const storage = resolveStorage(custom);
    expect(storage).toBe(custom);
    await storage.setItem('k', 'v');
    expect(backing.get('k')).toBe('v');
  });
});

/** Minimal sync Web Storage stub (the real API is synchronous). */
function fakeWebStorage() {
  const backing = new Map<string, string>();
  return {
    backing,
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
  };
}

describe("browser storage modes ('local' | 'session')", () => {
  it("'local' is backed by globalThis.localStorage in a browser", async () => {
    const local = fakeWebStorage();
    vi.stubGlobal('document', {});
    vi.stubGlobal('localStorage', local);
    const storage = resolveStorage('local');
    await storage.setItem('k', 'v');
    expect(local.backing.get('k')).toBe('v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(local.backing.has('k')).toBe(false);
  });

  it("'session' is backed by globalThis.sessionStorage in a browser", async () => {
    const session = fakeWebStorage();
    vi.stubGlobal('document', {});
    vi.stubGlobal('sessionStorage', session);
    const storage = resolveStorage('session');
    await storage.setItem('k', 'v');
    expect(session.backing.get('k')).toBe('v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(session.backing.has('k')).toBe(false);
  });

  it("'local' and 'session' hit their own backing, not each other's", async () => {
    const local = fakeWebStorage();
    const session = fakeWebStorage();
    vi.stubGlobal('document', {});
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    await resolveStorage('local').setItem('k', 'from-local');
    await resolveStorage('session').setItem('k', 'from-session');
    expect(local.backing.get('k')).toBe('from-local');
    expect(session.backing.get('k')).toBe('from-session');
  });

  it('throws loudly AT RESOLVE TIME off-browser (no globalThis.document)', () => {
    // No document stub — this is the server/Workers case. The throw must
    // happen when the client is created, not on the first token read.
    expect(() => resolveStorage('local')).toThrowError(
      "storage mode 'local' is browser-only — use 'nostore' + per-call headers on the server",
    );
    expect(() => resolveStorage('session')).toThrowError(
      "storage mode 'session' is browser-only — use 'nostore' + per-call headers on the server",
    );
  });

  it('a full auth session round-trips through writeSession/clearSession', async () => {
    const local = fakeWebStorage();
    vi.stubGlobal('document', {});
    vi.stubGlobal('localStorage', local);
    const storage = resolveStorage('local');
    await writeSession(storage, {
      accessToken: 'jwt',
      refreshToken: 'refresh',
    });
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('jwt');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh');
    // A second resolution sees the same persisted pair (it's real storage,
    // not per-instance memory).
    const again = resolveStorage('local');
    expect(await again.getItem(ACCESS_TOKEN_KEY)).toBe('jwt');
    await clearSession(again);
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});

describe('session helpers', () => {
  it('writeSession persists both token keys and clearSession removes them', async () => {
    const storage = resolveStorage('memory');
    await writeSession(storage, {
      accessToken: 'jwt',
      refreshToken: 'refresh',
    });
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBe('jwt');
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh');
    await clearSession(storage);
    expect(await storage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});

describe('blocked-storage browsing contexts', () => {
  it('surfaces the module contract error, not a raw SecurityError', () => {
    vi.stubGlobal('document', {});
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      expect(() => resolveStorage('local')).toThrow(/blocked/);
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
      vi.unstubAllGlobals();
    }
  });
});

describe('board-scoped browser storage (multi-board origins)', () => {
  it('two boards on one origin never share token keys', async () => {
    vi.stubGlobal('document', {});
    const backing = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    });
    try {
      const a = resolveStorage('local', 'pk_boardA');
      const b = resolveStorage('local', 'pk_boardB');
      await a.setItem(ACCESS_TOKEN_KEY, 'tokenA');
      await b.setItem(ACCESS_TOKEN_KEY, 'tokenB');
      expect(await a.getItem(ACCESS_TOKEN_KEY)).toBe('tokenA');
      expect(await b.getItem(ACCESS_TOKEN_KEY)).toBe('tokenB');
      await a.removeItem(ACCESS_TOKEN_KEY);
      expect(await a.getItem(ACCESS_TOKEN_KEY)).toBeNull();
      expect(await b.getItem(ACCESS_TOKEN_KEY)).toBe('tokenB');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('scope collision safety', () => {
  it("distinct boards that sanitize identically don't share keys", async () => {
    vi.stubGlobal('document', {});
    const backing = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    });
    try {
      const a = resolveStorage('local', 'acme.jobs');
      const b = resolveStorage('local', 'acme_jobs');
      await a.setItem(ACCESS_TOKEN_KEY, 'tokenA');
      await b.setItem(ACCESS_TOKEN_KEY, 'tokenB');
      expect(await a.getItem(ACCESS_TOKEN_KEY)).toBe('tokenA');
      expect(await b.getItem(ACCESS_TOKEN_KEY)).toBe('tokenB');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
