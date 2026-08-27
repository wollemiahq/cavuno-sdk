---
name: cavuno-board-setup
description: Orchestrate a headless Cavuno board integration. Use when starting a frontend with @cavuno/board or adding Cavuno board surfaces to an existing app.
---

# Set up a Cavuno board

Build the board as a sequence of working slices. The framework owns rendering and routing; Cavuno skills own Board API behavior and data contracts.

## 1. Map the host app

Read `package.json`, the route tree, environment conventions, and existing data-fetching boundaries. Use the framework skills already installed in the project for framework APIs, including TanStack Start, Next.js, Remix, Nuxt, SvelteKit, Astro, and SolidStart.

Choose where public reads run and identify the server boundary for bearer tokens. `@cavuno/board` runs in browsers, Node 20+, and Cloudflare Workers.

**Complete when:** the framework, route convention, rendering boundary, and server-only environment boundary are identified from the repository.

## 2. Configure one client

Read the board identifier from the host framework's public environment convention. Prefer the immutable, publishable `pk_…` key; it is safe to expose. The default API origin is `https://api.cavuno.com`; set `baseUrl` only for a Cavuno-supplied alternate origin.

```ts
import { createBoardClient } from '@cavuno/board';

export const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
});
```

Use `cavuno-board-api-client` for hooks, headers, caching, and SSR state boundaries.

**Complete when:** one reused client resolves `board.context()` with the expected board name.

## 3. Build a vertical jobs slice

Render the shell from `board.context()`, including board identity and branding. Treat its `features` as capabilities: expose each optional surface only when its capability is enabled.

Then build the jobs list and detail routes with `cavuno-board-jobs`. Preserve the hosted board's indexed route contract:

- `/jobs`, `/jobs/:keyword`, and `/jobs/locations/:slug` are listings.
- `/companies/:companySlug/jobs/:jobSlug` is a job detail.

Use `cavuno-board-format`, `cavuno-board-filters`, and `cavuno-board-search-suggestions` for their respective display, URL-filter, and search-suggestion contracts.

**Complete when:** a real job card links to a working canonical detail page, and a fabricated slug renders the app's handled not-found state.

## 4. Add identity and access

Use `cavuno-board-auth` for board-user registration, login, verification, recovery, and browser storage. In a server-rendered app, use `cavuno-board-server-sessions` as the authority for the httpOnly session cookie, per-call bearer header, and `createSessionRefresher`. Use `cavuno-board-errors` for typed failure branches and board-password grants.

**Complete when:** an authenticated `board.me.retrieve()` succeeds, logout returns the app to a signed-out state, and concurrent server requests share the server skill's single-flight refresher.

## 5. Add only the enabled surfaces

Route each enabled capability to its focused skill:

| Surface | Skill |
| --- | --- |
| Companies and markets | `cavuno-board-companies` |
| Blog | `cavuno-board-blog` |
| Salary pages | `cavuno-board-salaries` |
| Job alerts | `cavuno-board-job-alerts` |
| Candidate account | `cavuno-board-account` |
| Saved jobs and applications | `cavuno-board-applications` |
| Messaging | `cavuno-board-messaging` |
| Candidate paywall | `cavuno-board-paywall` |
| Employer talent access | `cavuno-board-talent-access` |
| Public job posting | `cavuno-board-post-a-job` |
| Localized chrome | `cavuno-board-i18n` |
| Metadata and structured data | `cavuno-board-seo` |
| Sitemap routes | `cavuno-board-sitemap` |

The app remains the source of page composition, chrome copy, and marketing or legal prose. Cavuno supplies data and helpers for the artifacts its focused skills cover.

**Complete when:** every implemented optional route maps to an enabled board capability and the relevant focused skill's verification passes.

## 6. Prove the integration

Run `cavuno-board-smoke-test` with the real `pk_…` value. Its runtime probes and production build are the completion gate for setup.

Pause with a concrete blocker when the board identifier or a required test credential is unavailable, or the public API probe fails before it reaches app code.

**Complete when:** doctor, direct API probes, implemented-surface checks, and the production-build probe all pass or each skipped credentialed check is reported.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
