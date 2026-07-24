import { describe, expect, it } from 'vitest';

import {
  ALL_ROLES,
  CANONICAL_MANIFEST,
  compileManifest,
  type RouteEntry,
  type RouteRole,
} from '../route-contract';
import {
  createWellKnownHandler,
  emitWellKnownManifest,
  routeEntriesFromTanStackRouteTree,
  type TanStackRouteNode,
} from './index';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Hard-coded identity templates — mirrors route-contract starter fixture. */
const HARDCODED_CANONICAL_ROLES: Record<RouteRole, string> = {
  jobDetail: '/companies/:companySlug/jobs/:jobSlug',
  jobsCategory: '/jobs/:categorySlug',
  jobsSkill: '/jobs/skills/:skillSlug',
  jobsLocation: '/jobs/locations/:placeSlug',
  company: '/companies/:companySlug',
  companyMarket: '/companies/markets/:marketSlug',
  companySalary: '/companies/:companySlug/salaries',
  salaryTitle: '/salaries/titles/:titleSlug',
  salarySkill: '/salaries/skills/:skillSlug',
  salaryLocation: '/salaries/locations/:placeSlug',
  blogPost: '/blog/:postSlug',
  blogTag: '/blog/tag/:tagSlug',
  blogAuthor: '/blog/author/:authorSlug',
  home: '/',
  jobs: '/jobs',
  companies: '/companies',
  salaries: '/salaries',
  salaryCompanies: '/salaries/companies',
  salaryTitles: '/salaries/titles',
  salarySkills: '/salaries/skills',
  salaryLocations: '/salaries/locations',
  blog: '/blog',
  about: '/about',
  privacyPolicy: '/privacy-policy',
  termsOfService: '/terms-of-service',
  cookiePolicy: '/cookie-policy',
  impressum: '/impressum',
  talent: '/talent',
  employers: '/employers',
  alertsManage: '/alerts/manage',
  alertsConfirm: '/alerts/confirm',
};

function canonicalRouteEntries(): RouteEntry[] {
  return Object.entries(HARDCODED_CANONICAL_ROLES).map(([role, template]) => ({
    template,
    sourcePath: `src/routes/${role}.tsx`,
  }));
}

describe('well-known endpoint', () => {
  // ──  ──────────────────────────────────────────────────────────────
  describe('handler serves compiled manifest for starter fixture', () => {
    it('returns version 1, jobDetail template, content-type + cache-control', async () => {
      const handler = createWellKnownHandler({
        routes: canonicalRouteEntries(),
      });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      expect(res.headers.get('cache-control')).toBe('public, max-age=300');

      const body = (await res.json()) as {
        version: number;
        roles: Record<string, string>;
      };
      expect(body.version).toBe(1);
      expect(body.roles.jobDetail).toBe(
        '/companies/:companySlug/jobs/:jobSlug',
      );
      // Wire format is the versioned manifest only — no warnings/ambiguities.
      expect(body).toEqual(compileManifest(canonicalRouteEntries()).manifest);
      expect('warnings' in body).toBe(false);
      expect('ambiguities' in body).toBe(false);
      expect(body).toEqual(CANONICAL_MANIFEST);
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('moved-structure fixture serves the moved template', () => {
    it('jobDetail is the restructured path (marker escape hatch)', async () => {
      const sourcePath = 'src/routes/positions.$jobSlug.tsx';
      const routes: RouteEntry[] = [
        { template: '/positions/:jobSlug', sourcePath },
        { template: '/alerts/manage', sourcePath: 'alerts-manage.tsx' },
        { template: '/alerts/confirm', sourcePath: 'alerts-confirm.tsx' },
      ];
      const markers = new Map<string, RouteRole>([[sourcePath, 'jobDetail']]);
      const handler = createWellKnownHandler({ routes, markers });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        version: number;
        roles: Record<string, string>;
      };
      expect(body.version).toBe(1);
      expect(body.roles.jobDetail).toBe('/positions/:jobSlug');
    });

    it('infers jobDetail from moved directories with matching signature', async () => {
      const routes: RouteEntry[] = [
        {
          template: '/orgs/:companySlug/roles/:jobSlug',
          sourcePath: 'src/routes/orgs.$companySlug.roles.$jobSlug.tsx',
        },
        { template: '/alerts/manage', sourcePath: 'alerts-manage.tsx' },
        { template: '/alerts/confirm', sourcePath: 'alerts-confirm.tsx' },
      ];
      const handler = createWellKnownHandler({ routes });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );
      const body = (await res.json()) as { roles: Record<string, string> };
      expect(body.roles.jobDetail).toBe('/orgs/:companySlug/roles/:jobSlug');
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('async routes thunk', () => {
    it('supports an async routes thunk', async () => {
      const handler = createWellKnownHandler({
        routes: async () => canonicalRouteEntries(),
      });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { version: number };
      expect(body.version).toBe(1);
    });

    it('thunk throw → 500 with empty body (never a stack trace)', async () => {
      const handler = createWellKnownHandler({
        routes: async () => {
          throw new Error('boom secret stack');
        },
      });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toBe('');
      expect(text).not.toContain('boom');
      expect(text).not.toContain('stack');
      expect(text).not.toContain('Error');
    });

    it('sync thunk throw → 500 with empty body', async () => {
      const handler = createWellKnownHandler({
        routes: () => {
          throw new Error('sync boom');
        },
      });
      const res = await handler(
        new Request('https://board.example/.well-known/cavuno.json'),
      );
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('');
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('TanStack enumerator', () => {
    it('converts $param → :param, $ splat → *, skips technical/pathless nodes', () => {
      // Minimal structural tree matching TanStack Route shape (fullPath +
      // children). Not a real @tanstack instance — board-sdk has no runtime
      // dep on the package.
      const tree: TanStackRouteNode = {
        id: '__root__',
        path: '/',
        fullPath: '/',
        children: [
          {
            id: '/',
            path: '/',
            fullPath: '/',
          },
          {
            id: '/jobs',
            path: 'jobs',
            fullPath: '/jobs',
            children: [
              {
                id: '/jobs/$categorySlug',
                path: '$categorySlug',
                fullPath: '/jobs/$categorySlug',
              },
              {
                id: '/jobs/skills/$skillSlug',
                path: 'skills/$skillSlug',
                fullPath: '/jobs/skills/$skillSlug',
              },
            ],
          },
          {
            // Pathless layout — technical, must be skipped as a page entry
            // (its children still contribute).
            id: '/_auth',
            path: '_auth',
            fullPath: '/_auth',
            children: [
              {
                id: '/_auth/alerts/manage',
                path: 'alerts/manage',
                fullPath: '/alerts/manage',
              },
            ],
          },
          {
            id: '/companies/$companySlug/jobs/$jobSlug',
            path: 'companies/$companySlug/jobs/$jobSlug',
            fullPath: '/companies/$companySlug/jobs/$jobSlug',
          },
          {
            id: '/files/$',
            path: 'files/$',
            fullPath: '/files/$',
          },
          {
            // Non-page technical: no fullPath and no usable path
            id: '/_internal',
            path: '',
          },
        ],
      };

      const entries = routeEntriesFromTanStackRouteTree(tree);
      const templates = entries.map((e) => e.template).sort();

      expect(templates).toContain('/');
      expect(templates).toContain('/jobs');
      expect(templates).toContain('/jobs/:categorySlug');
      expect(templates).toContain('/jobs/skills/:skillSlug');
      expect(templates).toContain('/companies/:companySlug/jobs/:jobSlug');
      expect(templates).toContain('/alerts/manage');
      expect(templates).toContain('/files/*');

      // Pathless layout itself must not appear as a page template.
      expect(templates).not.toContain('/_auth');
      expect(templates.some((t) => t.includes('_auth'))).toBe(false);
      // Empty technical node skipped.
      expect(templates).not.toContain('');
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('emitWellKnownManifest', () => {
    it('returns deterministic JSON at the well-known path (ALL_ROLES key order)', () => {
      const result = emitWellKnownManifest({
        routes: canonicalRouteEntries(),
      });

      expect(result.path).toBe('.well-known/cavuno.json');

      const parsed = JSON.parse(result.contents) as {
        version: number;
        roles: Record<string, string>;
      };
      expect(parsed.version).toBe(1);
      expect(parsed).toEqual(CANONICAL_MANIFEST);

      // Stable key order: roles appear in ALL_ROLES order.
      const roleKeys = Object.keys(parsed.roles);
      const expectedOrder = ALL_ROLES.filter(
        (r) => r in HARDCODED_CANONICAL_ROLES,
      );
      expect(roleKeys).toEqual(expectedOrder);

      // Deterministic across calls.
      const again = emitWellKnownManifest({
        routes: canonicalRouteEntries(),
      });
      expect(again.contents).toBe(result.contents);
    });

    it('matches the runtime handler body for the same tree', async () => {
      const routes = canonicalRouteEntries();
      const emitted = emitWellKnownManifest({ routes });
      const handler = createWellKnownHandler({ routes });
      const res = await handler(
        new Request('https://x/.well-known/cavuno.json'),
      );
      expect(await res.text()).toBe(emitted.contents);
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('purity guard', () => {
    it('imports nothing outside the package (no node: / no external pkgs)', () => {
      const dir = dirname(fileURLToPath(import.meta.url));
      const sources: string[] = [];

      function walk(d: string) {
        for (const name of readdirSync(d)) {
          const p = join(d, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
            sources.push(p);
          }
        }
      }
      walk(dir);

      expect(sources.length).toBeGreaterThan(0);

      for (const file of sources) {
        const text = readFileSync(file, 'utf8');
        const code = text
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');

        const importLines = code.match(/(?:from|import)\s+['"]([^'"]+)['"]/g);
        if (!importLines) continue;

        for (const line of importLines) {
          const m = line.match(/['"]([^'"]+)['"]/);
          if (!m) continue;
          const spec = m[1]!;
          expect(
            spec.startsWith('.') || spec.startsWith('/'),
            `${file} imports external "${spec}"`,
          ).toBe(true);
          expect(spec.startsWith('node:'), `${file} imports ${spec}`).toBe(
            false,
          );
        }
      }
    });
  });
});
