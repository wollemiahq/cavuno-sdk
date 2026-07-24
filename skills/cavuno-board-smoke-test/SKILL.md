---
name: cavuno-board-smoke-test
description: Runtime verification for a wired Cavuno board frontend — literal curl probes against the Board API plus per-surface behavioral checks and a mandatory production-build pass. Run after cavuno-board-setup finishes, after upgrading @cavuno/board, or whenever board wiring is suspect. Type checks are not enough for board wiring.
---

# Smoke-testing a Cavuno board frontend

Type checks prove the code compiles against the SDK; they do not prove the
app reaches the right board with the right credentials, or that gating,
auth, and SEO surfaces behave. Verify at runtime, in this order.

## When to use

- Right after `cavuno-board-setup` completes.
- After upgrading `@cavuno/board` or rotating the `pk_…` key.
- When any surface renders empty and you don't know which layer is wrong.

## 0 — Run `doctor` first (deterministic pass)

```bash
PUBLIC_CAVUNO_BOARD=pk_... \
  npx @cavuno/board doctor --frontend http://localhost:3000
```

Doctor codifies the static checks (env shape, API reachability) and the
read probes (home/jobs render, JobPosting JSON-LD, sitemap, robots) as
pass/fail/skip with a non-zero exit on failure — anything it SKIPS is
named in its summary and still needs the manual checks below. Use the
rest of this skill for the behavioral checks doctor does not automate
(auth flows, gating semantics, production build).

Doctor is non-destructive. It validates configuration, the public Board API,
installed skills, and—when `--frontend` is provided—rendered pages, sitemaps,
robots rules, and JobPosting structured data. It never creates users,
applications, or alerts and needs no Cavuno operator credentials.

## 1 — Probe the API directly (before blaming app code)

Use the real `PUBLIC_CAVUNO_BOARD` value the app reads. The SDK and doctor use `https://api.cavuno.com` by default; set `PUBLIC_CAVUNO_API_URL` only for a Cavuno-supplied non-production override. Expected outputs are exact.

```bash
CAVUNO_API_URL="${PUBLIC_CAVUNO_API_URL:-https://api.cavuno.com}"

# Board context: MUST return JSON with "object": "public_board" and your
# board's name — not an HTML error page, not {"error":{"code":"boards_not_found"}}.
curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD" | head -c 300

# Jobs list: MUST return {"object":"list", ... "data":[...]}. An empty data
# array on a board you know has jobs means the wrong board identifier.
curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD/jobs?limit=2" | head -c 300

# Error envelope: a bogus job slug MUST return the v1 error shape with
# "code":"jobs_not_found" — anything else means a proxy is rewriting responses.
curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD/jobs/definitely-not-a-job"
```

On a password-protected board, every content read above returns 401 with
`"code":"board_password_required"` — that is correct behavior, not a
failure; verify the grant flow in step 3 instead.

## 2 — Verify the app serves board data

Start the app (dev is fine for this step) and probe its own routes:

- The home/shell renders the board name and logo from `board.context()`.
- A listing page shows real job cards; a card links to
  `/companies/:companySlug/jobs/:jobSlug` (never `/jobs/:slug`).
- A fabricated job URL renders the app's not-found state — a handled
  `isNotFound` branch, not a crash or blank page.

## 3 — Per-surface behavioral checks (only for surfaces you built)

- **Auth**: register → the verification gate appears; login → an authed
  read (`me.retrieve`) succeeds; after `auth.logout()` the same read fails
  with a 401 that the app handles by signing out, not looping.
- **Password gate**: with protection enabled, an anonymous content read
  redirects to the password page; `password.verify()` + retry renders
  content; a wrong password shows `board_password_invalid` messaging.
- **Saved jobs / apply**: save → reload → still saved (server state, not
  local); a second apply to the same job returns the same application
  (idempotent), not a duplicate.
- **Paywall** (gated boards): anonymous list shows the `gatedCount` upsell;
  an entitled login makes the same URL return the ungated view.
- **Alerts**: subscribe → `status: "submitted"`; repeat → same uniform `"submitted"` (never reveals already-subscribed).

## 4 — Production build (mandatory)

Dev servers mask wiring bugs (looser env loading, dev-only middleware, no
tree-shake). Run the app's real build, boot the production output, and
repeat step 2 against it. `import 'server-only'`-style boundaries and env
prefixes (`VITE_`, `NEXT_PUBLIC_`) frequently pass dev and fail prod.

## Out of scope — do not invent checks

No load testing, no Lighthouse/SEO scoring, no visual regression — those
are app-owned. This skill verifies board wiring only.

## Stop conditions

Stop and report to the human when: step 1 fails (the problem is
credentials/network, not code — do not "fix" app code to compensate); the
API returns codes the app has no branch for; or a check needs a credential
you don't have (board password, test account). Never commit real
credentials while fixing findings.
