---
name: cavuno-board-smoke-test
description: Prove a Cavuno board integration at runtime. Use after initial setup, an @cavuno/board upgrade, a board-key rotation, or when rendered board data is unexpectedly missing.
---

# Smoke-test a Cavuno board

Follow the layers in order. Each passing layer narrows the next failure to app wiring rather than credentials or the public API.

## 1. Run doctor

```bash
PUBLIC_CAVUNO_BOARD=pk_... \
  npx @cavuno/board doctor --frontend http://localhost:3000
```

Doctor checks environment shape, API reachability, installed skills, and—when `--frontend` is present—rendered pages, sitemap, robots rules, and JobPosting structured data. It is read-only and reports every skipped check.

**Complete when:** doctor exits zero and every skip that applies to an implemented surface is recorded for manual verification below.

## 2. Probe the public API

Use the exact board value and API origin read by the app:

```bash
CAVUNO_API_URL="${PUBLIC_CAVUNO_API_URL:-https://api.cavuno.com}"

curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD" | head -c 300
curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD/jobs?limit=2" | head -c 300
curl -s "$CAVUNO_API_URL/v1/boards/$PUBLIC_CAVUNO_BOARD/jobs/definitely-not-a-job"
```

The context response has `"object":"public_board"` and the expected name. The jobs response has `"object":"list"` and a `data` array. The fabricated slug has the v1 error code `jobs_not_found`. A protected board instead returns `board_password_required` for content reads; that is the expected pre-grant state.

Pause here when the API is unreachable, resolves a different board, or returns a non-v1 envelope. Report this layer as the blocker and preserve app code.

**Complete when:** identity, list shape, and error-envelope probes match the expected board, or the protected-board challenge is confirmed.

## 3. Probe the development app

Start the app and verify:

- The shell renders the name and logo from `board.context()`.
- A listing renders real jobs and links to `/companies/:companySlug/jobs/:jobSlug`.
- A fabricated job route renders the app's not-found state.

**Complete when:** all three behaviors are visible through the app rather than inferred from types or source code.

## 4. Exercise each implemented stateful surface

Run only the branches the app exposes:

- **Auth:** register, observe verification state, log in, prove `me.retrieve`, log out, then prove the app handles the next authenticated read as signed out.
- **Password gate:** confirm the anonymous challenge, verify the password, retry successfully, then confirm a wrong password renders `board_password_invalid`.
- **Saved jobs and applications:** save and reload to prove server persistence; submit the same application twice and confirm one application identity.
- **Paywall:** compare the anonymous `gatedCount` state with the entitled view at the same URL.
- **Alerts:** submit twice and confirm both responses preserve the uniform `submitted` state.

Pause a branch when its board password or test account is unavailable and report the exact credential needed.

**Complete when:** every implemented branch passes or has an explicit credential blocker; logout and refresh paths terminate without loops.

## 5. Prove the production artifact

Run the app's production build, boot that output, and repeat the three app probes from step 3 against it. Use the app's real production command and environment-loading path.

**Complete when:** the build succeeds and the running production artifact passes the shell, listing/detail-link, and not-found probes.

The smoke test covers Cavuno board wiring. Performance, visual regression, and broader SEO scoring belong to their dedicated project checks.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
