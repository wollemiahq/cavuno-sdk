import { describe, expect, it } from 'vitest';

import {
  CANONICAL_MANIFEST,
  compileManifest,
  extractCavunoPageMarker,
  ROLE_PARAM_REGISTRY,
  REQUIRED_ROLES,
  type RouteEntry,
  type RouteRole,
  validateManifest,
} from './index';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Hard-coded identity templates — locks helper interpolation (F6a). */
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

/** Starter fixture: one RouteEntry per hardcoded canonical role. */
function canonicalRouteEntries(): RouteEntry[] {
  return Object.entries(HARDCODED_CANONICAL_ROLES).map(([role, template]) => ({
    template,
    sourcePath: `src/routes/${role}.tsx`,
  }));
}

describe('route-contract compiler', () => {
  // ──  / F6a ────────────────────────────────────────────────────────
  describe('starter canonical set compiles to identity', () => {
    it('CANONICAL_MANIFEST.roles matches hard-coded literals (all 31)', () => {
      expect(Object.keys(CANONICAL_MANIFEST.roles).sort()).toEqual(
        Object.keys(HARDCODED_CANONICAL_ROLES).sort(),
      );
      for (const [role, template] of Object.entries(
        HARDCODED_CANONICAL_ROLES,
      )) {
        expect(
          CANONICAL_MANIFEST.roles[role as RouteRole],
          `canonical template drift for ${role}`,
        ).toBe(template);
      }
    });

    it('compiles hard-coded starter routes to CANONICAL_MANIFEST with zero markers', () => {
      const routes = canonicalRouteEntries();
      const result = compileManifest(routes);

      expect(result.manifest).toEqual({
        version: 1,
        roles: HARDCODED_CANONICAL_ROLES,
      });
      expect(result.ambiguities).toEqual([]);
      expect(result.blockingMissing).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('renamed structure — signature guard + marker escape', () => {
    it('does NOT infer jobDetail from /positions/:jobSlug (wrong signature)', () => {
      const routes: RouteEntry[] = [
        {
          template: '/positions/:jobSlug',
          sourcePath: 'src/routes/positions.$jobSlug.tsx',
        },
      ];
      const result = compileManifest(routes);

      expect(result.manifest.roles.jobDetail).toBeUndefined();
      expect(result.blockingMissing).toContain('jobDetail');
    });

    it('assigns jobDetail via marker when signature does not match', () => {
      const sourcePath = 'src/routes/positions.$jobSlug.tsx';
      const routes: RouteEntry[] = [
        { template: '/positions/:jobSlug', sourcePath },
      ];
      const markers = new Map<string, RouteRole>([[sourcePath, 'jobDetail']]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.jobDetail).toBe('/positions/:jobSlug');
      expect(result.blockingMissing).not.toContain('jobDetail');
      expect(result.ambiguities).toEqual([]);
    });

    it('infers jobDetail from exact signature with moved directories', () => {
      const routes: RouteEntry[] = [
        {
          template: '/orgs/:companySlug/roles/:jobSlug',
          sourcePath: 'src/routes/orgs.$companySlug.roles.$jobSlug.tsx',
        },
      ];
      const result = compileManifest(routes);

      expect(result.manifest.roles.jobDetail).toBe(
        '/orgs/:companySlug/roles/:jobSlug',
      );
      expect(result.blockingMissing).not.toContain('jobDetail');
      expect(result.ambiguities).toEqual([]);
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('ambiguity — two same-signature routes', () => {
    it('reports ambiguity naming both candidates and leaves role unassigned', () => {
      const routes: RouteEntry[] = [
        {
          template: '/companies/:companySlug/jobs/:jobSlug',
          sourcePath: 'a.tsx',
        },
        {
          template: '/posts/:companySlug/:jobSlug',
          sourcePath: 'b.tsx',
        },
      ];
      const result = compileManifest(routes);

      expect(result.manifest.roles.jobDetail).toBeUndefined();
      expect(result.blockingMissing).toContain('jobDetail');

      const amb = result.ambiguities.find((a) => a.role === 'jobDetail');
      expect(amb).toBeDefined();
      expect(amb!.candidates).toHaveLength(2);
      expect(amb!.candidates.map((c) => c.template).sort()).toEqual([
        '/companies/:companySlug/jobs/:jobSlug',
        '/posts/:companySlug/:jobSlug',
      ]);
    });

    it('resolves ambiguity when a marker claims one candidate', () => {
      const routes: RouteEntry[] = [
        {
          template: '/companies/:companySlug/jobs/:jobSlug',
          sourcePath: 'a.tsx',
        },
        {
          template: '/posts/:companySlug/:jobSlug',
          sourcePath: 'b.tsx',
        },
      ];
      const markers = new Map<string, RouteRole>([['b.tsx', 'jobDetail']]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.jobDetail).toBe(
        '/posts/:companySlug/:jobSlug',
      );
      expect(
        result.ambiguities.find((a) => a.role === 'jobDetail'),
      ).toBeUndefined();
      expect(result.blockingMissing).not.toContain('jobDetail');
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('missing required vs optional roles', () => {
    it('blockingMissing contains absent required roles', () => {
      const result = compileManifest([{ template: '/' }]);

      for (const role of REQUIRED_ROLES) {
        expect(result.blockingMissing).toContain(role);
      }
    });

    it('missing optional role yields a warning only', () => {
      const routes = canonicalRouteEntries().filter(
        (r) => r.template !== HARDCODED_CANONICAL_ROLES.blogPost,
      );
      const result = compileManifest(routes);

      expect(result.blockingMissing).toEqual([]);
      expect(result.manifest.roles.blogPost).toBeUndefined();
      expect(result.warnings.some((w) => w.includes('blogPost'))).toBe(true);
    });
  });

  // ──  ──────────────────────────────────────────────────────────────
  describe('validateManifest', () => {
    it('accepts a well-formed manifest', () => {
      const result = validateManifest(CANONICAL_MANIFEST);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.manifest).toEqual(CANONICAL_MANIFEST);
      }
    });

    it('rejects an unknown role', () => {
      const result = validateManifest({
        version: 1,
        roles: { notARealRole: '/x' },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some(
            (e) =>
              e.code === 'unknown_role' && e.message.includes('notARealRole'),
          ),
        ).toBe(true);
      }
    });

    it('rejects jobDetail template with unregistered :jobId token, naming it', () => {
      const result = validateManifest({
        version: 1,
        roles: {
          jobDetail: '/jobs/:jobId',
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.errors.find((e) => e.code === 'unregistered_param');
        expect(err).toBeDefined();
        expect(err!.token).toBe('jobId');
        expect(err!.role).toBe('jobDetail');
        expect(err!.message).toMatch(/:jobId/);
      }
    });

    it('rejects a static role template that contains a : token', () => {
      const result = validateManifest({
        version: 1,
        roles: {
          about: '/about/:slug',
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some(
            (e) => e.code === 'static_has_params' && e.role === 'about',
          ),
        ).toBe(true);
      }
    });

    it('allows jobDetail to omit companySlug when jobSlug remains', () => {
      const result = validateManifest({
        version: 1,
        roles: {
          jobDetail: '/positions/:jobSlug',
        },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects wrong version', () => {
      const result = validateManifest({ version: 2, roles: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'invalid_version')).toBe(
          true,
        );
      }
    });
  });

  // ── : template shape ──────────────────────────────────────────────
  describe('validateManifest template shape', () => {
    it("rejects '  ' with invalid_template naming the role", () => {
      const result = validateManifest({
        version: 1,
        roles: { about: '  ' },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some(
            (e) =>
              e.code === 'invalid_template' &&
              e.role === 'about' &&
              e.message.includes('about'),
          ),
        ).toBe(true);
      }
    });

    it("rejects 'about' (no leading slash)", () => {
      const result = validateManifest({
        version: 1,
        roles: { about: 'about' },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some(
            (e) => e.code === 'invalid_template' && e.role === 'about',
          ),
        ).toBe(true);
      }
    });

    it("rejects ' /about ' (whitespace)", () => {
      const result = validateManifest({
        version: 1,
        roles: { about: ' /about ' },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some(
            (e) => e.code === 'invalid_template' && e.role === 'about',
          ),
        ).toBe(true);
      }
    });

    it("accepts '/about'", () => {
      const result = validateManifest({
        version: 1,
        roles: { about: '/about' },
      });
      expect(result.ok).toBe(true);
    });

    // Fix 4 — strict path shape (SSRF / open-redirect templates).
    it.each([
      {
        name: 'protocol-relative',
        template: '//evil.com/:companySlug',
        code: 'template_double_slash' as const,
      },
      {
        name: 'dot-dot segment',
        template: '/companies/../:companySlug',
        code: 'template_dot_segment' as const,
      },
      {
        name: 'query string',
        template: '/orgs/:companySlug?x=//evil.com',
        code: 'template_query_or_fragment' as const,
      },
      {
        name: 'fragment',
        template: '/orgs/:companySlug#//evil.com',
        code: 'template_query_or_fragment' as const,
      },
    ])('rejects attack template $name', ({ template, code }) => {
      const result = validateManifest({
        version: 1,
        roles: { company: template },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === code)).toBe(true);
      }
    });

    it('every CANONICAL_MANIFEST template still validates (table-driven)', () => {
      for (const [role, template] of Object.entries(CANONICAL_MANIFEST.roles)) {
        const result = validateManifest({
          version: 1,
          roles: { [role]: template },
        });
        expect(
          result.ok,
          `canonical ${role}=${JSON.stringify(template)} should validate`,
        ).toBe(true);
      }
    });
  });

  // ── : compile self-validation ─────────────────────────────────────
  describe('compileManifest self-validates assigned templates', () => {
    it("marker jobDetail '/x/:unknown' → dropped + blockingMissing", () => {
      const routes: RouteEntry[] = [
        { template: '/x/:unknown', sourcePath: 'bad.tsx' },
      ];
      const markers = new Map<string, RouteRole>([['bad.tsx', 'jobDetail']]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.jobDetail).toBeUndefined();
      expect(result.blockingMissing).toContain('jobDetail');
      expect(
        result.warnings.some(
          (w) => w.includes('jobDetail') && w.includes('cavunoPage'),
        ),
      ).toBe(true);
    });

    it("marker alertsManage '/alerts/manage/:token' → dropped + blocking", () => {
      const routes: RouteEntry[] = [
        { template: '/alerts/manage/:token', sourcePath: 'alerts.tsx' },
      ];
      const markers = new Map<string, RouteRole>([
        ['alerts.tsx', 'alertsManage'],
      ]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.alertsManage).toBeUndefined();
      expect(result.blockingMissing).toContain('alertsManage');
      expect(
        result.warnings.some(
          (w) => w.includes('alertsManage') && w.includes('cavunoPage'),
        ),
      ).toBe(true);
    });

    it('optional role with bad template → dropped + warned, not blocking', () => {
      const routes: RouteEntry[] = [
        { template: '/blog/:notAParam', sourcePath: 'blog.tsx' },
      ];
      const markers = new Map<string, RouteRole>([['blog.tsx', 'blogPost']]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.blogPost).toBeUndefined();
      expect(result.blockingMissing).not.toContain('blogPost');
      expect(
        result.warnings.some(
          (w) => w.includes('blogPost') && w.includes('cavunoPage'),
        ),
      ).toBe(true);
    });
  });

  // ── : dual markers → ambiguity ────────────────────────────────────
  describe('two markers claiming the same role', () => {
    it('reports ambiguity with both candidates; role unassigned + blocking', () => {
      const routes: RouteEntry[] = [
        {
          template: '/companies/:companySlug/jobs/:jobSlug',
          sourcePath: 'a.tsx',
        },
        {
          template: '/posts/:companySlug/:jobSlug',
          sourcePath: 'b.tsx',
        },
      ];
      const markers = new Map<string, RouteRole>([
        ['a.tsx', 'jobDetail'],
        ['b.tsx', 'jobDetail'],
      ]);
      const result = compileManifest(routes, markers);

      expect(result.manifest.roles.jobDetail).toBeUndefined();
      expect(result.blockingMissing).toContain('jobDetail');

      const amb = result.ambiguities.find((a) => a.role === 'jobDetail');
      expect(amb).toBeDefined();
      expect(amb!.candidates).toHaveLength(2);
      expect(amb!.candidates.map((c) => c.sourcePath).sort()).toEqual([
        'a.tsx',
        'b.tsx',
      ]);
    });
  });

  // ── : required ambiguity warning ──────────────────────────────────
  describe('required role ambiguity produces cavunoPage warning', () => {
    it("warning string contains both 'jobDetail' and 'cavunoPage'", () => {
      const routes: RouteEntry[] = [
        {
          template: '/companies/:companySlug/jobs/:jobSlug',
          sourcePath: 'a.tsx',
        },
        {
          template: '/posts/:companySlug/:jobSlug',
          sourcePath: 'b.tsx',
        },
      ];
      const result = compileManifest(routes);

      expect(
        result.warnings.some(
          (w) => w.includes('jobDetail') && w.includes('cavunoPage'),
        ),
      ).toBe(true);
    });
  });

  // ──  / : markers ────────────────────────────────────────────────
  describe('extractCavunoPageMarker', () => {
    it('reads single-quoted role', () => {
      expect(
        extractCavunoPageMarker(`export const cavunoPage = 'jobDetail';\n`),
      ).toBe('jobDetail');
    });

    it('reads double-quoted role', () => {
      expect(
        extractCavunoPageMarker(`export const cavunoPage = "alertsManage";\n`),
      ).toBe('alertsManage');
    });

    it('tolerates as const', () => {
      expect(
        extractCavunoPageMarker(
          `export const cavunoPage = 'company' as const;\n`,
        ),
      ).toBe('company');
    });

    it("normalizes kebab-case 'job-detail' → jobDetail", () => {
      expect(
        extractCavunoPageMarker(`export const cavunoPage = 'job-detail';\n`),
      ).toBe('jobDetail');
    });

    it("normalizes kebab-case 'alerts-manage' → alertsManage", () => {
      expect(
        extractCavunoPageMarker(`export const cavunoPage = 'alerts-manage';\n`),
      ).toBe('alertsManage');
    });

    it('returns null for junk role strings', () => {
      expect(
        extractCavunoPageMarker(
          `export const cavunoPage = 'not-a-real-role';\n`,
        ),
      ).toBeNull();
    });

    it('returns null when no marker is present', () => {
      expect(
        extractCavunoPageMarker(`export default function Page() {}\n`),
      ).toBe(null);
    });
  });

  // ── F6b: shared-signature pairs ─────────────────────────────────────
  describe('F6b: shared-signature company / companySalary', () => {
    it("'/orgs/:companySlug' alone assigns NEITHER company nor companySalary", () => {
      const result = compileManifest([
        { template: '/orgs/:companySlug', sourcePath: 'orgs.tsx' },
      ]);
      expect(result.manifest.roles.company).toBeUndefined();
      expect(result.manifest.roles.companySalary).toBeUndefined();
    });

    it('both canonical templates present → each assigns to its own role', () => {
      const result = compileManifest([
        {
          template: '/companies/:companySlug',
          sourcePath: 'company.tsx',
        },
        {
          template: '/companies/:companySlug/salaries',
          sourcePath: 'salary.tsx',
        },
      ]);
      expect(result.manifest.roles.company).toBe('/companies/:companySlug');
      expect(result.manifest.roles.companySalary).toBe(
        '/companies/:companySlug/salaries',
      );
    });
  });

  // ── F6c: compile → validate integration ─────────────────────────────
  describe('F6c: compile→validate integration', () => {
    it('compileManifest with zero blocking passes validateManifest ok:true', () => {
      const result = compileManifest(canonicalRouteEntries());
      expect(result.blockingMissing).toEqual([]);
      const validated = validateManifest(result.manifest);
      expect(validated.ok).toBe(true);
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

  // ── Registry sanity ─────────────────────────────────────────────────
  describe('role registry', () => {
    it('REQUIRED_ROLES are email-emitting and present in the registry', () => {
      expect(REQUIRED_ROLES).toEqual([
        'jobDetail',
        'alertsManage',
        'alertsConfirm',
      ]);
      for (const role of REQUIRED_ROLES) {
        expect(ROLE_PARAM_REGISTRY[role]).toBeDefined();
      }
    });

    it('CANONICAL_MANIFEST version is 1 and covers every registry role', () => {
      expect(CANONICAL_MANIFEST.version).toBe(1);
      for (const role of Object.keys(ROLE_PARAM_REGISTRY) as RouteRole[]) {
        expect(
          CANONICAL_MANIFEST.roles[role],
          `missing canonical template for ${role}`,
        ).toBeTypeOf('string');
      }
    });
  });
});
