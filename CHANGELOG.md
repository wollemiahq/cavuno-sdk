# Changelog

This changelog records changes that affect Board API compatibility, exported
types, runtime behavior, or supported integration patterns.

## 3.2.0 — 2026-08-03

- Added `formatSalaryStatUsd`, `formatSalaryStatRange`, `normalizeWebsiteUrl`,
  and `buildJobBreadcrumbs` to `@cavuno/board/format`. These presentation
  helpers previously required importing `@cavuno/board/seo`, which pulled the
  structured-data builders into client bundles; frontends can now keep the SEO
  entry server-only. The `@cavuno/board/seo` exports are unchanged.
- Split the ESM builds of the isomorphic entries into shared chunks, so a
  selective import no longer carries unrelated builders. CommonJS output is
  unchanged.
- `listingHead` accepts an optional `language` and groups the result count for
  that locale in the title and meta description (`1,225 Jobs` / `1.225 Jobs`),
  matching how listing bodies render the same number. Callers that omit
  `language` keep byte-identical output.

## 3.1.0 — 2026-08-03

- Added direct skills.sh installation guidance and repository grouping for all
  22 Cavuno Board SDK skills.
- Linked every independently installable skill to the Cavuno SDK documentation.

## 3.0.0 — 2026-08-03

- Removed runtime theme data from `board.context()` and removed the
  `PublicBoardTheme` type and `@cavuno/board/theme` export. Applications now
  own their presentation tokens and styling independently of Board API data.
- Retired the Cavuno theme skill and the bundled TanStack Start flavor. The
  framework-neutral SDK skills were rewritten around concrete integration
  tasks, with clearer names for API client setup, server sessions, search
  suggestions, and public job posting.

## 2.1.0 — 2026-08-01

- Removed private starter-repository links from the public SDK documentation.
- Repaired the audited public-repository export metadata and standalone
  package lockfile used by trusted publishing.

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
