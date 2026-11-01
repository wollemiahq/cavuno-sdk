import { describe, expect, it } from 'vitest';

import { runDoctor } from './run';

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';

async function listen(server: Server, port = 0): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('doctor sitemap destination confinement', () => {
  it.each(['page', 'child'] as const)(
    'rejects an opaque %s location before contacting its destination',
    async (kind) => {
      let canaryHits = 0;
      const canary = createServer((_req, res) => {
        canaryHits++;
        res.end('<html>internal service</html>');
      });
      let loc = '';
      const frontend = createServer((req, res) => {
        if (req.url === '/sitemap.xml') {
          res.end(
            kind === 'child'
              ? `<sitemapindex><sitemap><loc>${loc}</loc></sitemap></sitemapindex>`
              : `<urlset><url><loc>${loc}</loc></url></urlset>`,
          );
        } else if (req.url === '/v1/openapi.json') {
          res.end('{"openapi":"3.1.0"}');
        } else {
          res.end('<html>frontend</html>');
        }
      });
      // An opaque pathname can append a digit to the frontend port, escaping
      // to a second loopback server without DNS or a replacement transport.
      let frontendUrl = '';
      for (let port = 4000; port < 6000; port++) {
        try {
          frontendUrl = await listen(frontend, port);
        } catch {
          continue;
        }
        try {
          await listen(canary, port * 10 + 1);
          break;
        } catch {
          await close(frontend);
          frontendUrl = '';
        }
      }
      if (!frontendUrl) throw new Error('No loopback port pair available');
      loc = 'data:1/probe';
      try {
        const { results } = await runDoctor({
          env: { apiUrl: frontendUrl },
          frontendUrl,
          projectRoot: tmpdir(),
          fetchImpl: fetch,
        });
        expect(canaryHits).toBe(0);
        expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe(
          'fail',
        );
      } finally {
        await close(frontend);
        await close(canary);
      }
    },
  );

  it.each([
    [
      'https://canonical.example//other.example/jobs?limit=1',
      '//other.example/jobs?limit=1',
    ],
    ['/jobs?limit=1', '/jobs?limit=1'],
    [
      'https://canonical.example/%2f%2fother.example/jobs',
      '/%2f%2fother.example/jobs',
    ],
    [
      'https://canonical.example/\\\\other.example/jobs',
      '///other.example/jobs',
    ],
  ])('keeps %s on the frontend origin', async (loc, expectedPath) => {
    const calls: string[] = [];
    const frontendUrl = 'https://preview.example';
    const { results } = await runDoctor({
      env: { apiUrl: frontendUrl },
      frontendUrl,
      projectRoot: tmpdir(),
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/sitemap.xml'))
          return new Response(`<urlset><url><loc>${loc}</loc></url></urlset>`);
        return new Response('<html>frontend</html>');
      },
    });
    expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe('pass');
    expect(calls).toContain(frontendUrl + expectedPath);
    expect(calls.every((url) => new URL(url).origin === frontendUrl)).toBe(
      true,
    );
  });

  it('preserves the frontend base path and the sitemap query', async () => {
    const calls: string[] = [];
    const frontendUrl = 'https://preview.example/nested/base/';
    await runDoctor({
      env: { apiUrl: 'https://preview.example' },
      frontendUrl,
      projectRoot: tmpdir(),
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(
          String(input).endsWith('/sitemap.xml')
            ? '<urlset><url><loc>jobs?limit=1#section</loc></url></urlset>'
            : '<html>frontend</html>',
        );
      },
    });
    expect(calls).toContain('https://preview.example/nested/base/jobs?limit=1');
  });

  it.each([
    'data:.attacker.example/probe',
    'file:///etc/passwd',
    'http://[invalid',
  ])(
    'fails a malformed or non-HTTP location %s without probing it',
    async (loc) => {
      const calls: string[] = [];
      const { results } = await runDoctor({
        env: { apiUrl: 'https://preview.example' },
        frontendUrl: 'https://preview.example',
        projectRoot: tmpdir(),
        fetchImpl: async (input) => {
          calls.push(String(input));
          return new Response(
            String(input).endsWith('/sitemap.xml')
              ? `<urlset><url><loc>${loc}</loc></url></urlset>`
              : '<html>frontend</html>',
          );
        },
      });
      expect(results.find((r) => r.id === 'read.sitemap')?.status).toBe('fail');
      expect(calls).toHaveLength(10);
    },
  );
});
