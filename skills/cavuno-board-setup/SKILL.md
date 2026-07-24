---
name: cavuno-board-setup
description: End-to-end orchestrator for building a headless Cavuno job board with the @cavuno/board SDK. Start here after `npx @cavuno/board setup` copies the skills — detect the framework, wire the client, render board context, jobs browsing and detail, board-user auth and saved jobs, handle errors and access gating, then verify.
---

# Setting up a Cavuno board

`@cavuno/board` is a thin, isomorphic, typed client for the Cavuno Board API (`/v1/boards/:identifier/*`). It brings the commerce of a job board — jobs, companies, blog, search, auth, saved jobs, alerts — to the framework you already use. You bring the framework and own the layout; the SDK brings the data contract.

This skill is the orchestrator. Work top to bottom, delegating each surface to its focused skill.

## When to use

- Standing up a new headless board frontend against the Board API.
- Adding board data (jobs/companies/blog/auth) to an existing app.
- After `npx @cavuno/board setup` has installed the package and copied these skills.

## When not to use

- Authoring the hosted board inside the Cavuno admin (that's the operator Puck builder, not the SDK).
- Building operator automation — use the public `cavuno` CLI or REST API;
  `@cavuno/board` is for visitor-facing board experiences.

## Inspect the app

Read `package.json` and the project layout before writing anything. Identify: the framework (see below), whether it renders on a server (SSR/RSC) or only in the browser, and where server-only secrets are read. Match the project's existing conventions — do not introduce a new data-fetching style.

## Detect the framework

`@cavuno/board` is framework-agnostic: it needs only `fetch` and runs in the browser, Node ≥ 20, and Cloudflare Workers. Detect the framework from dependencies and adapt:

- `@tanstack/react-start` → the reference flavor. Read `cavuno-board-tanstack-start` for SSR-loader + cookie wiring.
- `next` → use Server Components + per-call `FetchOptions` (`next: { revalidate, tags }`).
- Anything else (Nuxt, SvelteKit, Astro, SolidStart, plain JS) → use the core skills directly; the SDK surface is identical.

## Use the standard board environment name

Read the board key from the environment; never hard-code it:

- `PUBLIC_CAVUNO_BOARD` — the board identifier. Use the `pk_…` publishable key, not the slug (the slug is operator-mutable and breaks deployed frontends on rename).

The `pk_…` key is public-safe by design. Use your framework's public-env convention for the variable name (`VITE_`, `PUBLIC_`, `NEXT_PUBLIC_`). The SDK uses `https://api.cavuno.com` by default. Pass `baseUrl` only when Cavuno supplies a staging or development origin.

## Keep credentials server-side

The board identifier is public. A board-user **bearer JWT is not** — it must never reach the browser bundle. On a server framework, keep the session in an httpOnly cookie owned by your app and pass it per call; see `cavuno-board-auth`.

## Use board route conventions

The canonical public job-detail URL is `/companies/:companySlug/jobs/:jobSlug` — a job needs both slugs. `/jobs`, `/jobs/:keyword`, `/jobs/locations/:slug` are listing/search pages, never individual jobs. Mirror these paths so a board migrating hosted → headless keeps its indexed URLs.

## Wire the client

Create one client and reuse it. See `cavuno-board-client`.

```ts
import { createBoardClient } from '@cavuno/board';

export const board = createBoardClient({
  board: process.env.PUBLIC_CAVUNO_BOARD!,
});
```

## Build the board shell from context

`board.context()` (a root method on the client) returns identity, theme, analytics, and the board's capability `features` flags. Render branding from it and **gate every optional surface on its capability flag** — only build a route when its feature is enabled. (A dedicated context skill ships with a later slice; the return type is self-describing until then.)

## Build jobs browsing + detail

The core surface. `jobs.list` / `jobs.search` for listing pages, `jobs.retrieve` for the detail page, `jobs.similar` for the related rail. Honor catalog pagination and the candidate-paywall `gatedCount`; use `paginate()` for full-catalog walks (sitemaps, feeds). See `cavuno-board-jobs`.

## Add board users + saved jobs

Register/login/refresh/logout, then `me.retrieve` and `me.savedJobs.*`. There is **no auto-refresh on 401** — handle it explicitly. See `cavuno-board-auth`.

## Handle errors + gating

Every method throws `BoardApiError` on a non-2xx; branch with the typed guards. Password-protected boards need a `password.verify()` grant. See `cavuno-board-errors`.

## Style, format, and filter with the helper subpaths

Three subpath modules carry the display layer — use them instead of
hand-rolling (each has a skill):

- Salary/date/label formatting in the board language → `cavuno-board-format`
- Listing-filter vocabulary + URL param parsing → `cavuno-board-filters`
- Optional hosted-board theme compatibility → `cavuno-board-theme`. By default, the consuming application owns tokens, fonts, and color mode.

## Build the remaining surfaces per feature flag

One focused skill per surface — delegate by name, and build a surface only
when its `features` flag (from `board.context()`) is enabled:

- Companies directory, markets, per-company jobs → `cavuno-board-companies`
- Blog (posts, tags, authors, search) → `cavuno-board-blog`
- Programmatic salary pages → `cavuno-board-salaries`
- Job alerts (anonymous double-opt-in + account CRUD) → `cavuno-board-job-alerts`
- Candidate account self-service (profile, resume, avatar, prefs) → `cavuno-board-account`
- Apply flow + my applications + saved jobs → `cavuno-board-applications`
- Candidate↔employer messaging (polled REST) → `cavuno-board-messaging`
- Candidate job-access paywall (offers, checkout, grant) → `cavuno-board-paywall`
- Public job-posting funnel (plans, submit, billing) → `cavuno-board-job-posting`

## App-owned concerns (out of scope)

The SDK serves data only. Your app owns: page layout and chrome copy, marketing/legal prose, and the authoring of SEO artifacts (sitemap, RSS, OG images) — built from API data, not served as documents. The Board API never returns layouts or page-builder JSON.

## Verification

- `board.context()` resolves and returns your board's name.
- A listing page renders cards from `board.jobs.list()`.
- A detail page renders from `board.jobs.retrieve(slug)`.
- An invalid slug surfaces a handled `isNotFound(err)` path, not a crash.

Then run the `cavuno-board-smoke-test` skill against your `pk_…` — type checks are not enough for board wiring.

## Stop conditions

Stop and ask the human when: no `pk_…` board identifier is available; the framework is unrecognized and has no server boundary for credentials; or a surface you need (e.g. job alerts, applications) has no corresponding skill yet — the SDK only exposes endpoints that are live, so a missing skill means the endpoint isn't shipped.
