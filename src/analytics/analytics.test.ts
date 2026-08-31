import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_COLLECT_URL,
  DEFAULT_SCRIPT_URL,
  PENDING_TENANT_ID,
  WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
  WELL_KNOWN_COLLECT_PATH,
  analytics,
  install,
  matchAnalyticsWellKnown,
  track,
} from './index';

type FakeScript = {
  defer: boolean;
  src: string;
  dataset: Record<string, string>;
  attrs: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
};

describe('@cavuno/board/analytics', () => {
  const fetchMock = vi.fn();
  let scripts: FakeScript[];
  let appended: FakeScript[];

  beforeEach(() => {
    scripts = [];
    appended = [];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const documentStub = {
      location: {
        hostname: 'jobs.example.com',
        origin: 'https://jobs.example.com',
      },
      createElement(tag: string) {
        if (tag !== 'script') {
          throw new Error(`unexpected tag ${tag}`);
        }
        const el: FakeScript = {
          defer: false,
          src: '',
          dataset: {},
          attrs: {},
          setAttribute(name, value) {
            this.attrs[name] = value;
          },
        };
        scripts.push(el);
        return el;
      },
      head: {
        appendChild(node: FakeScript) {
          appended.push(node);
        },
      },
      getElementsByTagName() {
        return [];
      },
      querySelector() {
        return null;
      },
    };

    Object.defineProperty(globalThis, 'document', {
      value: documentStub,
      configurable: true,
      writable: true,
    });
    Reflect.deleteProperty(globalThis as object, 'CavunoAnalytics');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis as object, 'document');
    Reflect.deleteProperty(globalThis as object, 'CavunoAnalytics');
  });

  it('exports stable defaults without vendor host strings', () => {
    expect(DEFAULT_COLLECT_URL).toBe(
      'https://cavuno.com/api/analytics/collect',
    );
    expect(DEFAULT_SCRIPT_URL).toBe('https://cavuno.com/js/metrics.js');
    expect(PENDING_TENANT_ID).toBe('boards_pending');
    expect(JSON.stringify(analytics)).not.toMatch(/tinybird/i);
  });

  it('install defaults to central collect so self-host needs no Worker', () => {
    install({ publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });

    expect(appended).toHaveLength(1);
    const script = appended[0]!;
    expect(script.src).toBe(DEFAULT_SCRIPT_URL);
    expect(script.defer).toBe(true);
    expect(script.attrs['data-token']).toBe(
      'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(script.attrs['data-host']).toBe(DEFAULT_COLLECT_URL);
    expect(script.attrs['data-tenant-id']).toBe(PENDING_TENANT_ID);
    expect(script.attrs['data-cavuno-analytics']).toBe('1');
  });

  it('install accepts first-party well-known overrides when handlers exist', () => {
    install({
      publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      scriptUrl: WELL_KNOWN_ANALYTICS_SCRIPT_PATH,
      collectUrl: WELL_KNOWN_COLLECT_PATH,
    });

    expect(appended[0]!.src).toBe(WELL_KNOWN_ANALYTICS_SCRIPT_PATH);
    expect(appended[0]!.attrs['data-host']).toBe(WELL_KNOWN_COLLECT_PATH);
  });

  it('install keeps absolute defaults when options override', () => {
    install({
      publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      scriptUrl: DEFAULT_SCRIPT_URL,
      collectUrl: DEFAULT_COLLECT_URL,
    });

    expect(appended[0]!.src).toBe(DEFAULT_SCRIPT_URL);
    expect(appended[0]!.attrs['data-host']).toBe(DEFAULT_COLLECT_URL);
  });

  it('install uses absolute central defaults when document is missing', () => {
    Reflect.deleteProperty(globalThis as object, 'document');
    install({ publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    track('job_apply_click', { jobId: 'job_1' });

    expect(appended).toHaveLength(0);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(DEFAULT_COLLECT_URL);
  });

  it('track POSTs JSON to central collect with Bearer publishable key', () => {
    install({ publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    track('job_apply_click', { jobId: 'job_1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_COLLECT_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      action: 'job_apply_click',
      payload: { jobId: 'job_1' },
    });
  });

  it('rejects non-publishable keys', () => {
    expect(() => install({ publishableKey: 'sk_secret' })).toThrow(
      /publishable key/,
    );
  });

  it('exposes CavunoAnalytics.trackEvent after install', () => {
    install({ publishableKey: 'pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    const g = globalThis as {
      CavunoAnalytics?: {
        trackEvent: (a: string, p?: Record<string, unknown>) => void;
      };
    };
    expect(typeof g.CavunoAnalytics?.trackEvent).toBe('function');
    g.CavunoAnalytics!.trackEvent('page_hit', { pathname: '/' });
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('matchAnalyticsWellKnown', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects GET analytics.js to the central script URL', async () => {
    const response = await matchAnalyticsWellKnown(
      new Request('https://board.example/.well-known/cavuno/analytics.js'),
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(302);
    expect(response!.headers.get('Location')).toBe(DEFAULT_SCRIPT_URL);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for unrelated well-known paths', async () => {
    const response = await matchAnalyticsWellKnown(
      new Request(
        'https://board.example/.well-known/cf-custom-hostname-challenge/x',
      ),
    );
    expect(response).toBeNull();
  });

  it('answers OPTIONS collect with CORS', async () => {
    const response = await matchAnalyticsWellKnown(
      new Request('https://board.example/.well-known/cavuno/collect', {
        method: 'OPTIONS',
      }),
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(204);
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response!.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies POST collect to the central collect URL', async () => {
    const response = await matchAnalyticsWellKnown(
      new Request('https://board.example/.well-known/cavuno/collect', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'job_apply_click' }),
      }),
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_COLLECT_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('proxies POST collect/v0/events to the central events URL', async () => {
    await matchAnalyticsWellKnown(
      new Request(
        'https://board.example/.well-known/cavuno/collect/v0/events',
        {
          method: 'POST',
          body: '{"action":"page_hit"}\n',
        },
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${DEFAULT_COLLECT_URL}/v0/events`);
  });
});
