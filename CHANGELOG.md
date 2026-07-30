# Changelog

This changelog records changes that affect Board API compatibility, exported
types, runtime behavior, or supported integration patterns.

## 2.0.5 — 2026-07-30

- Added the optional `correction` object to board job catalog responses. It is
  present only when a free-text search that matched nothing was silently
  retried with one misspelled word corrected; `data` and `count` then belong to
  the corrected query. Absent on every other response, so existing consumers
  are unaffected.

## 2.0.4 — 2026-07-24

- Aligned npm, GitHub, README, and website metadata around building custom job
  boards and careers pages with Cavuno’s TypeScript SDK.
- Made the private Cavuno source the canonical input to audited public
  repository synchronization and trusted npm publishing.

## 2.0.3 — 2026-07-24

- Added verifiable npm provenance generated from the public Cavuno SDK source
  repository.
- Moved publishing to short-lived GitHub Actions credentials and made
  dependency installation reproducible with a committed lockfile.

## 2.0.2 — 2026-07-24

- Changed the public contact address to `hi@cavuno.com`.
- Simplified repository documentation for external contributors.

## 2.0.1 — 2026-07-24

- Pointed npm and support links to the standalone Cavuno SDK repository.
- Added the public license, trademark notice, security policy, contributing
  guide, and this consumer-facing changelog to the npm package.
- Improved package discovery metadata and linked directly to the
  [Cavuno SDK documentation](https://cavuno.com/docs/sdk).

## 2.0.0 — 2026-07-23

- Limited generated types to the public Board API and its referenced schemas.
- Removed service-specific diagnostic probes and write-based doctor checks.
- Preserved the public client, formatting, filters, SEO, sitemap, routing,
  authentication, candidate, employer, checkout, and job-board integration
  surfaces.
- Added standalone package and repository validation.
