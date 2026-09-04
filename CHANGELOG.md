# Changelog

This changelog records changes that affect Board API compatibility, exported
types, runtime behavior, or supported integration patterns.

## 4.21.1 — 2026-09-04

- **`BOARD_API_ERROR_CODES`**: adds `employer_free_email_website`, the 422
  returned when creating or updating a company with a free-email provider
  domain (gmail.com, outlook.com, and similar) as the website. Also exports
  `isFreeEmailWebsiteError()` so clients can show a field error instead of a
  generic failure. Ask for a real company website, or omit the website.

## 4.21.0 — 2026-09-03

- **`BOARD_API_ERROR_CODES`**: adds `candidate_paywall_access_required`, the
  403 returned by `board.me.recommendedJobs.list()` and the `board.me.alerts`
  reads and writes when the board's candidate paywall is active, the feature
  is enabled on the board, and the signed-in candidate's job seeker plan does
  not unlock it. Entitlements are per plan and are not published on the wire,
  so make the call and render the paywall (`board.paywall.offers()`) on this
  code instead of pre-gating from the board context.

## 4.20.0 — 2026-09-03

- **Memberships as public identity.** `PublicCompanyMembership` (`planId` +
  display name) is exported, and `board.companies.list({ membershipPlanId })`
  scopes the roster to the companies holding an active membership on that
  published plan. Combines with `marketSlug` by intersection; `count` then
  describes the members.
- **`board.plans.list({ purpose })`** accepts every plan purpose:
  `job_posting`, `talent_access`, `membership`, `job_seeker`,
  `employer_service`, `job_seeker_service`. Plans carry `pricingMode`; a
  `contact` plan is quote-only, so render `priceText` and the CTA fields
  instead of `price`.
- **`board.plans.salesLed()` is deprecated.** Use
  `plans.list({ purpose: 'employer_service' })` and keep the rows whose
  `pricingMode` is `contact`. The helper keeps working as a compatibility
  read.
- **`BOARD_API_ERROR_CODES`**: adds `membership_required`, returned when a
  board requires an approved membership to post and the caller has none.

## 4.19.0 — 2026-09-02

- **`board.sitemap()` / `board.sitemap.entries(bucket, { limit, cursor })`**:
  new namespace over `GET /sitemap` and `GET /sitemap/{bucket}`. The board
  publishes its complete sitemap — every bucket with an entry count, and each
  bucket's board-relative `path` + `lastModified` entries, cursor-paged up to
  1000 per page — so a headless frontend reproduces the hosted sitemap exactly
  (cross-axis salary pages, jobs place × category / skill pages, markets)
  without enumerating the catalog itself.
- **`@cavuno/board/sitemap` walker**: `listedBuckets` and `buildBucketUrls`
  now read the published sitemap first and fall back to the previous
  per-family enumeration only when the API answers 404. A sitemap build drops
  from ~25 catalog reads to a handful of cached reads. All existing exports
  are unchanged.
- **`board.companies.markets({ cursor })`**: the unsearched market list is
  now paginated (`hasMore` / `nextCursor` are real; use `paginate()`). With
  `search` it remains a top-N preview. `CompanyMarketsListQuery` gains `cursor`.

## 4.18.0 — 2026-09-02

- **`board.auth.requestMagicLink({ intent: 'sign_in' })`**: new optional
  `intent` on `POST /auth/magic-link`. Pass `'sign_in'` from a sign-in form so
  an unknown email is refused with 404 `board_auth_account_not_found` instead
  of silently minting a candidate sign-up token. Omit it to keep the previous
  sign-in-or-sign-up behaviour. Any other value is a 400.
- **`BOARD_API_ERROR_CODES`**: adds `board_auth_account_not_found`.

## 4.17.0 — 2026-08-31

- **`EmployerPipelineStage.systemStage`**: a closed set of pipeline literals —
  `shortlisted`, `contacted`, `replied`, `review`, `offer`, `hired`,
  `rejected`, or `null` — instead of an open string. `applied` remains a
  list-query alias for `review`, not a `systemStage` value.

## 4.16.0 — 2026-08-31

- **`@cavuno/board/analytics`**: new subpath with `install({ publishableKey })`
  and `track(action, payload?)`. Uses the board publishable key (`pk_…`) only.
  Default collect URL is Cavuno central collect; pass a first-party
  `/.well-known/cavuno/collect` URL when the board host serves those handlers.
- **Stable analytics tenant**: events are keyed by the immutable public board
  id (`boards_<accountId>`), not the mutable board slug.
- **Doctor**: `npx @cavuno/board doctor` includes an analytics-surface scan that
  flags legacy third-party tracker credentials in app source.

## 4.15.0 — 2026-08-30

- **LinkedIn conversion IDs on `board.context().analytics`**: five nullable
  Campaign Manager conversion IDs for direct Insight Tag installs (without
  GTM): `linkedInConversionSignUpId`, `linkedInConversionLoginId`,
  `linkedInConversionApplyClickId`, `linkedInConversionApplySubmitId`,
  `linkedInConversionJobAlertSubscribeId`. Use with `linkedInPartnerId` to
  fire `lintrk('track', { conversion_id })` for the same moments as the
  hosted board. Leave null when LinkedIn conversions are fired only via GTM.
  Meta still needs only `metaPixelId`; GTM still needs only `gtmId`.

## 4.14.0 — 2026-08-29

- **Talent lists**: `board.me.companies.talentLists` (`list` / `create` /
  `update` / `remove`). Company-owned saved predicates over the talent
  directory. `filters` reuse the frozen `/talent` query (`q`, `skill`,
  `jobSearchStatus`, `languages`, `openToRelocate`, `place`, `sort`,
  `seniority`, `permitCountry`, `interestedRole`). Optional `job` binds a
  list to one company job; pass `job: null` on update to unbind. Approved
  members share the same lists.
- **Sourced candidates**: `board.me.companies.sourcedCandidates` (`list` /
  `add` / `remove` / `convert`). Per-job membership rail. Saving a candidate
  always writes here. `convert` creates a pipeline application with source
  `sourced` (hidden from the candidate until they apply themselves).
  `stage: 'applied'` aliases to `review`. A board without a native pipeline
  raises `sourced_convert_unavailable` (409). `add` is idempotent
  (`created: false` on a second save).
- **Error codes**: `talent_list_not_found`, `sourced_candidate_not_found`,
  and `sourced_convert_unavailable` join `BOARD_API_ERROR_CODES`.
- **`board.auth.verifyWorkEmail({ token })`**: confirm an employer
  work-email token without a session (`POST /auth/verify-work-email`).
  `board.me.companies.workEmail.confirm(slug, { token })` is deprecated —
  `slug` is ignored; the token alone identifies the membership.
- **OAuth employer sign-up**: `getOAuthAuthorizationUrl(provider, { role:
  'employer' })` creates an employer profile for a new user. The role is
  fixed at authorize time and cannot be changed on the callback. Defaults
  to `candidate`.

## 4.13.0 — 2026-08-28

- **`board.context().contact.legalName`**: the operating company's registered
  legal name, or `null` when unset. Use it as the JobPosting
  `hiringOrganization` name when a job has no company of its own, ahead of the
  board name — that is the order the hosted board emits, so a headless board
  produces identical structured data. `buildJobPostingJsonLd` reads it from
  `contact.legalName` automatically; a top-level `legalName` is also accepted.
- **Candidate profile visibility default**: a board can set the visibility new
  candidate profiles start with, rather than every profile defaulting the same
  way.

## 4.12.0 — 2026-08-28

- **`resolveApplyDecision`**: the apply-decision ladder now takes the board's
  `features.registrationWall`. On a walled board an anonymous visitor gets
  `{ kind: 'sign-in' }` on every path, including the external employer
  `applicationUrl` — previously that link was returned to any viewer. Sign-in,
  not email verification, is the bar: a signed-in-but-unverified candidate
  still gets the external link.
- **New `guest` apply action**: with the wall off, `POST /jobs/:jobSlug/apply`
  accepts an unauthenticated caller supplying `name`/`email`, so the ladder can
  return `{ kind: 'guest', jobSlug }` instead of forcing sign-in and losing the
  application. Opt in with `allowGuestApply: true`; a client with no guest form
  keeps receiving `{ kind: 'sign-in' }`.
- **`sign-in` gains an optional `reason`** (`'registration-wall' | 'native-apply'`)
  so a client can tell a wall prompt from a native-ladder one.
- **`resolveApplyAction` is deprecated** in favour of `resolveApplyDecision`. It
  still behaves exactly as before (the wall and guest inputs are pinned off),
  so pinned callers are unaffected.
- **`board.context().jobForm` gains the job-form constraints** the platform
  enforces when a job is created: `salary.required` / `minBound` / `maxBound` /
  `allowedCurrencies`, `seniority.required` / `allowedOptions`,
  `location.allowedCountries`, and `workArrangement` / `employmentType`
  `allowedOptions`. Posting forms can now offer only what the board accepts
  instead of surfacing a 400 after submit. Closed enums arrive fully resolved
  (an unrestricted board gets the complete platform list); the open sets
  (`allowedCurrencies`, `allowedCountries`) use `null` for "no restriction" and
  are never empty. Salary bounds are present only when `salary.required`.

## 4.11.0 — 2026-08-28

- **`BoardAuthSession.isNewUser`**: optional boolean on OAuth exchange and
  magic-link consume. True when the exchange created the board user account
  (candidate or employer); false when it authenticated an existing account.
  Login, register, and refresh omit the field.

## 4.10.0 — 2026-08-28

- **Employer talent-access paywall** (a different buyer from the candidate
  paywall): `board.me.talentAccess` gains `retrieveCandidate`, `checkout`
  (connected-account embedded mount kit, `origin: talent_access`),
  `retrieveCheckout`, `unlock` (idempotent credit spend), and `upgrade`
  (in-place plan swap; never a second checkout). `retrieve()` now also
  returns `accessModel`, `companyId`, `unlockCreditsRemaining`,
  `messageCreditsRemaining`, and `hasUnlimitedMessages`.
- **Company billing portal**: `board.me.companies.billingPortal.create(slug)`
  mints a Stripe Customer Portal session covering every subscription on the
  company's Stripe customer (job posting + talent access).
- **Public talent reads**: `TalentDirectoryEntry` and `TalentProfile` gain
  `id` (the board-user id, the opaque `/p/{id}` route key). When a board
  sells profile unlocks, list and retrieve-by-id responses are redacted for
  viewers without entitlement; retrieve-by-handle stays the named-route
  share bypass.
- **Error codes**: `talent_access_unavailable`, `company_required`,
  `already_on_plan`, `talent_access_required`,
  `messaging_talent_access_required`, and `stripe_not_connected` join
  `BOARD_API_ERROR_CODES`.
- **New skill** `cavuno-board-talent-access` covering the full employer
  flow (CTA gating, checkout, unlock, upgrade, portal, message credits).

## 4.9.0 — 2026-08-27

- **`@cavuno/board/seo-files`**: new dependency-free subpath with
  `robotsResponse`, `adsTxtResponse`, `indexNowResponse`, and
  `googleSiteVerificationMeta`. Headless frontends serve `robots.txt`,
  `ads.txt`, and `indexnow-key.txt` byte-identically to hosted boards from
  `board.seo()`; the robots body now includes `Disallow: /go/` and
  `Disallow: /t/` like hosted boards.
- **Doctor**: `--frontend` probes gained `read.adsTxt`, `read.indexNow`,
  `read.googleVerification`, and `read.oauthCallback`, and `read.robots` now
  checks the `Sitemap:` line and `/go/` disallow. Results gained an additive
  `warn` status (`DoctorSummary.warned`) that never fails the run; a file that
  is served while unconfigured in the dashboard, or a missing OAuth callback
  forward, warns instead of failing. Read probes run serially and retry a
  503 child sitemap once.
- **`board.context()`**: exposes `ads` (`enabled`, `clientId`) and
  `jobForm` visibility, typed as `PublicBoardAds` and `PublicBoardJobForm`.
  Employer companies expose `deletionEnabled`.
- **Taxonomy lists** accept `sort: 'jobCount'` to order collections by live
  job count.
- **Generated types** cover the `candidate.profile.updated` webhook event
  and the operator candidate sync resources (`CandidateSyncSnapshot`,
  `CandidateReconcileResult`, and related bodies).

## 4.8.0 — 2026-08-23

- **Country-gated Apply flows**: compatible starters can use
  `board.jobs.createApplyIntent` for opaque external-apply redirects and
  `board.jobs.prepareApplyApproval` before native Apply. The browser completes
  country approval directly against the Cavuno Apply gateway, then returns the
  opaque receipt through the existing `board.jobs.apply` call. New job payloads
  expose `applyAction`, and native Apply accepts `approvalReceipt` plus the
  matching server-owned `approvalSessionKey`. These additions keep destination
  URLs and client-supplied country or IP values out of the trusted decision.

## 4.7.0 — 2026-08-23

- **`board.me.companies.recommendedTalent.list`**: candidates who fit one of
  your company's jobs, best match first, for a signed-in employer. Pass the
  company `slug` and the required `job`. Each item wraps the same
  `talent_directory_entry` card the public directory returns, so existing
  rendering works unchanged, and `jobSearchStatus` is populated even when the
  candidate scoped it to employers only, because the caller is a verified
  employer. Candidates who already applied to that job are excluded — they
  belong to the job's pipeline, not to sourcing — as are hidden profiles and
  anyone whose job-search status is `not_looking`. The response exposes no
  rank, score, band, or ranker identity, and ranking improves server-side
  without contract changes. The list is a bounded top slice, so expect it to
  be short; an empty `data` is not a relevance signal and can arrive
  mid-pagination, so follow `hasMore` / `nextCursor` rather than stopping at
  the first empty page. Requires an approved `company_membership` for the
  company, and the job must belong to it. A draft job answers
  `409 job_not_published` rather than an empty list — only published jobs
  carry the vectors matching needs. Exported types: `RecommendedTalent`,
  `RecommendedTalentListQuery`.

## 4.6.0 — 2026-08-22

- **`board.me.recommendedJobs.list`**: personalized jobs for the signed-in
  candidate, best match first. Each item wraps the same slim `job_card` the
  jobs list returns. The response never includes scores, weights, or ranker
  identity. Empty list means there is no usable profile signal yet — drive a
  resume-upload CTA from `board.me.profile` / `board.me.resume`. Exported
  types: `RecommendedJob`, `RecommendedJobsListQuery`. Documented in the
  account skill and [How to show job matches](https://cavuno.com/docs/sdk/cookbook/recommended-jobs).

## 4.5.0 — 2026-08-21

- **Board-user account self-service**: signed-in board users manage their own
  account over the API. New `board.me` verbs and `/v1/boards/{identifier}/me/*`
  endpoints: `updatePassword`, `requestEmailChange` / `confirmEmailChange`
  (verify-then-switch), and account deletion. The `board_user` resource now
  exposes `hasPassword` so headless frontends can decide between change-password
  and set-password flows.
- **Company team management**: `board.me.companies` gains members and invites —
  list members, change a member's role (`admin` / `member`), remove a member,
  create / list / revoke email invites (7-day links), accept an invite, and
  `leave(slug)` (`DELETE .../me/companies/{slug}/membership`). A company always
  keeps at least one admin: the API answers `409 last_admin` when an action
  would strand it.
- **Analytics**: apply-clicks and job-visitors reporting can group by
  first-touch channel, and apply-click rows carry `jobSlug`.
- **Company blocklist**: endpoints for blocking a company from automated
  sourcing so imports and aggregation cannot reintroduce it.
- **Fix**: salary formatting falls back cleanly when the runtime lacks
  `Intl.NumberFormat.formatRange`.

## 4.4.1 — 2026-08-10

- **SDK installation documentation**: The npm and GitHub README now presents
  package installation as the recommended TypeScript SDK path, with CDN
  installation as a separate option for static HTML and other no-build sites.
  Links point to the canonical SDK installation guides on cavuno.com.

## 4.4.0 — 2026-08-10

- **Classic-script browser build**: `@cavuno/board` now ships a dependency-free
  ES2020 IIFE at `dist/browser/cavuno-board.global.min.js` for static HTML,
  CMS, and other no-build integrations. It installs `globalThis.CavunoBoard`
  with the complete root client plus the browser-safe `format`, `filters`,
  `suggest`, `seo`, and `paths` namespaces. Existing ESM and CommonJS entries
  are unchanged; use ESM subpaths when tree-shaking matters. Production script
  tags should pin 4.4.0 exactly and use the release SHA-384 integrity value.
- **Automation job lifecycle events**: Zapier exposes separate job-created,
  job-updated, and job-deleted triggers. Created and updated events carry the
  allowlisted job snapshot, including HTML `description` and the public job
  `url`; deleted events carry the minimal tombstone required to remove a
  downstream copy.

## 4.3.1 — 2026-08-07

- **Public blog authors: `location` and `facebookUrl`**: list, retrieve, and
  post-embedded author objects now include optional `location` (free-text
  label, e.g. `"Sydney, Australia"`) and `facebookUrl` (normalized Facebook
  profile URL). Both are `string | null` on the wire; omit empty UI when null.
  Generated OpenAPI types and the `cavuno-board-blog` skill document the
  fields. Operators set them in the Cavuno author form (or v1 author write
  APIs).

## 4.3.0 — 2026-08-07

- **`CompanyPublic.salarySampleCount`**: number of jobs that contribute to a
  company's salary aggregates on the board (`0` when there is no usable
  sample). Prefer this over fetching the full company-salary document just to
  gate a Salaries tab or empty state. Distinct from `publishedJobCount` (open
  roles without pay data stay at 0 here).
- **`GET …/companies/{slug}/salaries/summary`** and
  `board.companies.salaries.summary(slug)`: lightweight profile teaser —
  overall pay numbers, top categories by sample size, `sampleCount`, and
  `currency` as `CompanySalarySummary`. Skips seniority, competitors,
  locations, and logo joins from the full `CompanySalary` document. Format
  currency ranges and multi-locale UI strings in the app.

## 4.2.0 — 2026-08-06

- **Board logo + favicon pack on `board.context()`**: public board context now
  includes `icons` next to `logoUrl` — absolute CDN URLs (or `null`) for
  `ico`, `svg`, `appleTouch`, `icon192`, `icon512`, and `iconMaskable512`.
  Derived from the operator logo (Settings → General upload / logo generator).
  Brand identity, not SEO infra — `board.seo()` stays ads/IndexNow/GSV/
  canonical/manifest.name only. Map `icons` into root-layout favicon `<link>`
  tags. Operators set the logo in Cavuno; the API resolves the pack.
- **Card `summary` on jobs, companies, and talent**: list/card models gain a
  server-derived plain-text `summary: string | null` — HTML stripped, entities
  decoded, cut at a sentence boundary (or word boundary with `…`). The API does
  the data cleaning; consumers decide how much of the string to show.
  - `PublicJobCard.summary` — denormalized at write time on
    `publicJobCardDocs` (backfill migration
    `jobs/migrations:backfillPublicJobCardSummary`). Independent of the
    existing `?fields=+description` opt-in, which keeps working as before.
  - `CompanyPublic.summary` — derived from `description` at serialization for
    list, search, and similar. Detail still ships the full HTML body.
  - `TalentDirectoryEntry.summary` — derived from `bio` at serialization.
- **Deprecations** (still returned; prefer `summary` for card teasers):
  - `CompanyPublic.description` on list/search/similar
  - `TalentDirectoryEntry.bio`

## 4.1.0 — 2026-08-06

- **Salary null-clears on job PATCH** (operator `PATCH /v1/jobs/:id` and
  employer `PATCH /v1/boards/:identifier/me/companies/:slug/jobs/:id`):
  `salaryMin`, `salaryMax`, `salaryCurrency`, and `salaryTimeframe` now
  accept an explicit `null` meaning "clear the stored value" — the same
  tri-state `applicationUrl` and `expiresAt` already document (value sets,
  `null` clears, omitted leaves unchanged). Clearing also drops the derived
  USD figures, so salary filters stop matching a job whose salary was
  withdrawn.
- **Structured remote fields on `PublicJobCard`**: `remoteWorldwide`
  (`boolean | null`) and `remoteWorkPermitCountryCodes` (`string[]`) beside
  the pre-worded `remoteLocationLabel`, so templates can word remote
  regions from their own catalogs instead of matching the board-language
  `"Worldwide"` label string. Derived from the same permit selection the
  label reads — the boolean and the label always agree.
- **Docs**: `Plan.name` and `Plan.description` are documented as authoring
  defaults — the localized public string lives in the board template,
  composed from `featureSummary`, `billingInterval`, and `talent`.
- **Marketing consent**: consent is a property of the board
  user. New `board.me.marketingConsent` namespace — `retrieve()` (the
  consent, or `null` when no decision exists), `grant()`, `withdraw()` —
  plus the `MarketingConsent` type. The API records the decision, never
  the prose: disclosure wording is authored by the board's own frontend.
- **Outbound webhooks**: webhook subscription endpoints and event types
  join the OpenAPI contract and generated types.

## 4.0.0 — 2026-08-03

- **Lossy seams:** Resolution is fine;
  discarding the input is not. After every call the application must
  still be able to produce a different legitimate rendering.
  - `resolveCustomFieldDisplay` multi-select returns
    `{ kind: 'multi_select', values: string[] }` instead of a
    pre-joined `kind: 'text'` sentence. `Intl.ListFormat` (or chips /
    short style / disjunction) moves to the app — same reason numbers
    stay raw. Leading `language` stays for signature stability; the SDK no longer reads it for multi-select.
  - `buildSalaryFaq` average entries carry `avgMin`, `avgMax`, and
    `currency` alongside the compact `range` convenience. FAQ prose can
    reformat with `notation: 'standard'` without re-threading the detail
    object. `label` is still echoed so FAQ mapping is a pure map over
    entries (the SDK never reads it for formatting).
  - `formatSalaryStat` / `formatSalaryStatRange` accept optional
    `notation` with the same magnitude default as `formatSalaryRange`
    (`|value| ≥ 1000` → compact; smaller → standard). `$90K` vs
    `$90,000` is register, not locale.
  - : remove `ListFormat` from "what the SDK keeps"; add the
    mechanical recoverability test and worked table; document Google
    controlled vocabularies (`EDUCATION_TO_CREDENTIAL`,
    `EMPLOYMENT_TYPE_TO_GOOGLE`) as wire values, not copy; correct that
    timeframe units ship as the wire enum, not unit words from `Intl`.

- **Pre-publish blockers (salary format + SEO paths):** Closes the final
  review that blocked publish.
  - `formatSalaryStat` / `formatSalaryStatRange` null-guard currency
    (`currency?.trim()`) so a runtime `null` returns `null` instead of
    `TypeError` — matches `formatSalaryRange` and the skill/changelog
    contract (`string | null`).
  - Non-finite amounts (`NaN`, `±Infinity`) return `null` across
    `formatSalaryStat`, `formatSalaryStatRange`, and `formatSalaryRange`
    (they are `number` at the type level and slip past `== null`).
  - Identical range ends (`min === max`) format as a fixed salary
    (single amount), not ICU's `approximatelySign` form (`~$140K`). A
    posted pin is not a degenerate range.
  - `formatSalaryRange` defaults `notation` by **magnitude**: compact
    only where ICU shortens (`|value| ≥ 1000`); smaller values stay
    `standard` so hourly/day rates keep CLDR minor units (`$22.50`,
    `KWD 22.567`). Explicit `notation` still wins.
  - `listingJsonLd` builds job URLs via `jobDetailPath` / `boardUrl`
    (drops company-less jobs rather than linking `/jobs/{slug}`); omits
    `BreadcrumbList` when the trail has fewer than 2 crumbs. 
    `buildJobBreadcrumbs` uses `paths/` helpers instead of hand-built
    strings.
  - `companySalaryJsonLd` / `locationSalaryJsonLd` accept omitted
    `options` and return `null` (siblings already did; these threw).

- **i18n audit (format / paths / skills):** Closes the specialist audit
  against ICU/CLDR/W3C practice. Architecture (discriminant seams, no
  composition, `Intl`-over-catalogs) stands; defects were concentrated in
  timezone pinning, CLDR width choice, and structure-vs-support locale
  validation.
  - `formatMonthYear` pins `timeZone: 'UTC'` (and date-only inputs as UTC
    midnight) so full ISO timestamps agree with `formatDate` under every
    host zone — no more `"Mai 2023"` / `"Dec 2022"` for June / Jan UTC.
  - `formatPublishedRelativeDate` uses RTF `style: 'short'` (not
    `narrow`). English reads `"5 days ago"`; French / Russian / Romanian
    no longer degrade to signed numbers (`-5 j`).
  - `normalizeLocale` requires `Intl.NumberFormat.supportedLocalesOf` —
    well-formed but unsupported tags (`xx`, `qqq`, `und`, …) return
    `null` instead of silently using the host default. Contract in
    `locale.ts`, `salary-range.ts`, and `skills/cavuno-board-format` is
    now enforced.
  - Currency fraction digits: compact notation keeps a one-digit cap
    (documented); `notation: 'standard'` (optional override on
    `formatSalaryRange`) lets each currency's CLDR minor units win.
    Default notation is magnitude-selected (see pre-publish blockers
    above), not unconditional compact.
  - `resolveCustomFieldDisplay` emits `kind: 'number'` with the raw
    value (not pre-stringified `kind: 'text'`), so the app formats with
    `Intl.NumberFormat`.
  - Path helpers percent-encode dynamic segments (non-ASCII board-language
    slugs become URIs for sitemap `<loc>`, canonical, email). `:` is kept
    for route-contract templates; already-encoded input is not
    double-encoded.
  - Filter / suggest Set keys NFC-normalize; suggest `minChars` counts
    graphemes (`Intl.Segmenter`), so a single CJK character qualifies.
  - `skills/cavuno-board-i18n` carries the five  obligations
    (plural selection, gender, bidi isolation with FSI/PDI, grapheme
    truncation, locale-aware case) and extends the completion gate.
    Salary-range / format skills document bidi isolation at the join
    site rather than returning `{ value, dir }`.

- **Rule (word order):** The SDK never decides what goes next to what.
  "No hardcoded strings" is the easy half. Word order is the half that
  survives a grep, because every operand is data and only the
  *arrangement* is English. A template with two data holes and a space
  (or `|`, or `/`) between them is an English sentence with the words
  removed. The SDK formats with `Intl`, returns structure, and leaves
  composition — counters, particles, separators, prefix vs postfix — to
  the application. Invalid locales prefer `null` over English-arranged
  fallbacks; underscore tags (`ja_JP`) normalize to BCP-47 (`ja-JP`) so
  one typo does not drop every formatter into English at once.

- **Breaking:** `listingHead` requires a caller-supplied `title` (same
  ownership as `description`). Removed `heading`, `boardName`, `count`,
  and `language` from `ListingHeadOptions` — the SDK no longer composes
  `` `${count} ${heading} | ${boardName}` `` (Japanese wants
  `1,225件の求人`, not `1,225 求人 | …`). Pass the finished title from
  the board's message catalog. Also removes the only unguarded
  `Intl.NumberFormat` construction in the SDK (a malformed board
  language no longer crashes the listing page).

- **Breaking:** `formatSalaryRange` returns
  `{ text, timeframe, bound } | null`. `text` is the `Intl`-formatted
  amount/range only; `timeframe` is the **wire enum** (`per_year`,
  `per_hour`, …) — never a unit word from `Intl` and never an owner
  override. Applications map the enum through their own catalog and
  compose amount↔timeframe order (`$90K / year` vs `年収900万〜1200万円`).
  Missing currency, invalid locale, or rejected currency format →
  `null` (no bare number, no English `M`/`k`/`$`).

- **Breaking:** Removed `SalaryTimeframeOverrides` from
  `@cavuno/board/format`. Owner-edited unit labels are application-side
  copy keyed off the wire `timeframe` enum the helper returns; the SDK
  no longer accepts an override map.

- **Breaking:** `GET/POST …/me/saved-jobs` embeds a slim `job_card` (the
  same shape as jobs list/search), not a full `public_job` with HTML
  `description`. Fetch the job detail by slug when the full body is
  needed. `remoteLocationLabel` is resolved server-side from
  `remoteRules`, so region-limited remote jobs keep their real region
  label instead of a client-side lossy guess.

- **Breaking:** Removed `fullJobToCard` from `@cavuno/board/format`. The
  saved-jobs endpoint now serves cards; convert with the same card VM as
  listings (`toJobCardVM(saved.job, …)`). That helper was the last
  user-facing hardcoded English in the SDK (`Remote`, `Worldwide`,
  `(hybrid)`).

- **Breaking:** `formatSalaryRange`'s board language is required — no
  silent `en` default. `formatPublishedRelativeDate` under one minute uses
  `Intl.RelativeTimeFormat` (`"now"` / `"jetzt"` / `"maintenant"`), not a
  hardcoded English string. `resolveCustomFieldDisplay` takes the board
  language as its leading parameter (signature stability). Multi-select
  originally joined via `Intl.ListFormat`; that was lossy and now returns
  `kind: 'multi_select'` with `values: string[]` (see Lossy seams above).

- **Breaking:** Renamed and currency-aware salary-stat formatters:
  `formatUsd` / `formatRange` → `formatSalaryStat(locale, value, currency)` /
  `formatSalaryStatRange(locale, min, max, currency)`. The `/format`
  aliases `formatSalaryStatUsd` / `formatSalaryStatRange` are replaced by
  the same names (no USD-only alias). `buildSalaryFaq` takes `currency`
  as a fourth argument so FAQ ranges match the board's money. Both formatters
  return `string | null` (`null` when currency is empty or `Intl` rejects
  the locale/currency) instead of inventing English `M`/`k` or a bare `$`.

- **Breaking:** `formatSalaryRange` first moved from `string | null` to
  `{ text; bound } | null` so open floors/ceilings are named by the app;
  the timeframe is now a third field (see top of this heading) rather than
  a suffix glued onto `text`.

- **Breaking:** Unit, currency, and date *words* derive from `Intl`;
  `skills/` snippets show shape (catalog placeholders), not pasteable
  English copy or join templates. The SDK formats with `Intl` and returns
  structure; it does not supply open-range chrome, nav/button copy, filter
  labels, SEO sentence templates, or amount↔unit arrangement. Dropped the
  private chrome-copy package dependency entirely. Closed ranges use
  `Intl.NumberFormat.prototype.formatRange` (locale owns separator,
  repeated currency/magnitude, and bidi marks). Open-range chrome and
  amount↔timeframe order are application-owned via `bound` + `timeframe`.
  `buildJobBreadcrumbs` no longer takes `language` or `labels` parameters —
  it returns structural `kind`s for chrome crumbs (`home` / `jobs`) instead
  of display names; applications supply the words when mapping to
  `BreadcrumbList`. `seniorityLabels` / `sortLabels` / `formatSeniority`
  are removed. Type exports removed with the chrome surface:
  `AlertsCopy`, `ApplyCopy`, `BlogCopy`, `BoardLabelOverrides`,
  `BreadcrumbsCopy`, `CopyLinkCopy`, `EntityCopy`, `FooterCopy`,
  `JobCardCopy`, `JobDetailCopy`, `JobSearchCopy`, `NavCopy`,
  `PaginationCopy`, `SalaryCopy`, `SalaryFrames`, `SalaryLexicon`,
  `SeniorityKey`, `UiCopy`.

- **Breaking:** `listingHead` requires a caller-supplied `description` (and
  now `title` — see top of this heading). It no longer composes
  `Browse … on …` (English on every locale) or case-folds the heading with
  locale-blind `.toLowerCase()`.

- **Breaking:** `buildSalaryFaq` returns structured
  `SalaryFaqEntry` values (`kind: 'average' | 'methodology'` plus label,
  `formatRange` range, and `jobCount`) instead of English FAQ prose.
  Map entries to `{ q, a }` in the application (with proper plural rules),
  then pass them to `faqJsonLd`.

- **Breaking:** Salary JSON-LD builders
  (`titleSalaryJsonLd`, `skillSalaryJsonLd`, `locationSalaryJsonLd`,
  `crossAxisSalaryJsonLd`, `companySalaryJsonLd`,
  `companyCategorySalaryJsonLd`) use data-only `name` fields (entity
  names). Removed English framing
  (`… salary (all levels)`, `Average Salary in …`, `Jobs at …`,
  `… salary in …`, trailing ` salary`).

- **Breaking:** Dropped the dead `locale` parameter from
  `titleSalaryJsonLd`, `crossAxisSalaryJsonLd`, `companySalaryJsonLd`,
  and `companyCategorySalaryJsonLd` — it was discarded (`void locale`)
  and did not change output. Per-seniority distribution names are no
  longer title-cased wire enums (`entry_level` → `Entry level`) and are
  no longer joined as `` `${seniority} ${entity}` `` (English word order).
  Pass optional `seniorityName({ seniority, entity })` that returns the
  finished string in board-language order, or omit it so those
  distributions ship without a `name` (valid structured data;
  wrong-language / wrong-order names are not).

- **Breaking:** `formatSalaryRange` never invents USD when
  `salaryCurrency` is null/empty — returns `null`, matching
  `createJobPostingJsonLd` which omits `baseSalary` without a currency.
  Invalid locales and rejected currency formats also return `null` rather
  than English `M`/`k`/`$` or a bare number.

- **Breaking:** `formatMonthYear` returns `string | null` — `null` on
  missing/unparseable input (never the English literal `"Invalid Date"`),
  and accepts full ISO timestamps in addition to date-only forms.

- **Breaking:** `locationSalaryJsonLd` and `companySalaryJsonLd` no
  longer emit an `Occupation` / `OccupationAggregationByEmployer`
  envelope with the place or employer as `name` (neither is an
  occupation). They emit an `ItemList` of the occupations present on
  that page (`topCategories` / `byCategory`), each linking to its own
  occupation page via required `occupationUrl`. Return `null` when
  there are no per-occupation rows (or when the location is not
  city/locality). The other four builders keep `Occupation`.

- **Breaking:** `board.taxonomy.suggestions.list` and
  `GET /v1/boards/{identifier}/suggestions` are removed. Use
  `board.search.suggest({ types: ['category', 'skill'], … })` instead. The
  `taxonomy` namespace itself stays (`categories`, `skills`, `places`,
  `remotePermits`, resolve methods).

- `board.search.suggest` accepts
  `types?: ('company' | 'category' | 'skill' | 'market' | 'post' | 'tag')[]`.
  Omit for every kind. `limit` applies **after** type filtering, so
  `{ types: ['skill'], limit: 10 }` returns up to ten skills.

- `SuggestionItem` gains a `market` variant (`type: 'market'`, `slug`, `name`,
  `companyCount`) for company-scope typeahead alongside companies.

- `SuggestionItem` gains `post` (`type: 'post'`, `id`, `slug`, `title`) and
  `tag` (`type: 'tag'`, `id`, `slug`, `name`) for blog typeahead. Blog posts
  and tags are public, so no extra access control.

- `@cavuno/board/paths` adds `suggestionPath(suggestion, { scope, location? })`
  plus `jobsLocationCategoryPath` / `jobsLocationSkillPath`. A jobs-scope
  company suggestion returns `null` — apply a `companySlug` filter; do not
  invent `/jobs/companies/<slug>`. Blog scope routes posts via
  `blogPostPath` and tags via `blogTagPath`.

- Added `sdk/reference/search.mdoc` and a docs-contract gate that every
  `BoardSdk` namespace has a matching reference page.

- The sitemap no longer advertises `/talent` on boards whose talent directory
  is `employers_only`. That page is gated behind an approved employer session,
  so listing it pointed crawlers at the gate rather than the directory. Only a
  `public` directory is listed.

- **Breaking:** `board.context().customFields` is now keyed by model instead of
  a flat job-only array. Today only `job` is present; `company` / `talent` keys
  land when those models ship (absent keys are not empty arrays).

  Before:

  ```json
  "customFields": [
    { "key": "security_clearance", "label": "Security clearance", "type": "single_select", "required": false }
  ]
  ```

  After:

  ```json
  "customFields": {
    "job": [
      { "key": "security_clearance", "label": "Security clearance", "type": "single_select", "required": false }
    ]
  }
  ```

  Resolve job values with `resolveCustomFieldDisplay(context.customFields.job, job.customFieldValues)`
  — the helper still takes a definitions array and did not change.

- **Breaking:** `features.talentDirectory` is now the tri-state access mode
  (`off` | `public` | `employers_only`). The top-level
  `talentDirectoryVisibility` field is removed — it duplicated the same gate.

  Before:

  ```json
  "features": { "talentDirectory": true },
  "talentDirectoryVisibility": "employers_only"
  ```

  After:

  ```json
  "features": { "talentDirectory": "employers_only" }
  ```

  Link `/talent` whenever `features.talentDirectory !== 'off'`. Do not treat
  the field as a boolean — the string `'off'` is truthy in JavaScript.

- **Breaking:** `board.seo()` no longer returns presentation. Removed
  `icons` (ico/svg/appleTouch/icon192/icon512/iconMaskable512) and
  `manifest.themeColor`. Kept `canonicalBase`, `adsTxt`, `indexNowKey`,
  `googleSiteVerification`, and `manifest.name`. Applications own brand
  assets and theme tokens.

  Before:

  ```json
  {
    "canonicalBase": "https://jobs.example.com",
    "adsTxt": null,
    "indexNowKey": null,
    "googleSiteVerification": null,
    "icons": { "ico": "…", "svg": null, "appleTouch": null, "icon192": null, "icon512": null, "iconMaskable512": null },
    "manifest": { "name": "Acme Jobs", "themeColor": "#1d4ed8" }
  }
  ```

  After:

  ```json
  {
    "canonicalBase": "https://jobs.example.com",
    "adsTxt": null,
    "indexNowKey": null,
    "googleSiteVerification": null,
    "manifest": { "name": "Acme Jobs" }
  }
  ```

- **Breaking:** `board.context().footer` is gone. Operator-authored contact
  and social identity move to a top-level `contact` group; editor-authored
  presentation (`description`, `navigationOrder`, `customLinks`) is removed
  — applications own footer layout.

  Before:

  ```json
  "footer": {
    "description": "Roles from {{board_name}}.",
    "contactEmail": "hello@acme.com",
    "websiteUrl": "https://acme.com/",
    "xUrl": "https://x.com/acmejobs",
    "facebookUrl": null,
    "linkedinUrl": "https://linkedin.com/company/acme",
    "navigationOrder": ["home", "blog"],
    "customLinks": [{ "id": "abc", "label": "Hub", "url": "/hub" }]
  }
  ```

  After:

  ```json
  "contact": {
    "email": "hello@acme.com",
    "websiteUrl": "https://acme.com/",
    "xUrl": "https://x.com/acmejobs",
    "facebookUrl": null,
    "linkedinUrl": "https://linkedin.com/company/acme"
  }
  ```

  Brand/social URL sanitization is unchanged (absolute http(s) only).
  `companyLegalName` / `companyAddress` were never on this public context
  payload (they ride the legal/impressum surface); no `company` group was
  invented here.

- **Breaking:** Chrome copy leaves the public `@cavuno/board` surface. Removed from `@cavuno/board/format`: `uiCopy`,
  `PUBLIC_LABEL_GROUPS`, `fieldLabel`, `getSalaryLexicon`, `locationLabel`,
  `cardLocationLabel`, `companyIntro`, and the `UiCopy` type re-export.
  Removed from `@cavuno/board/seo`: `formatSeniority`. Removed from
  `@cavuno/board/filters`: `seniorityLabels`, `sortLabels`.

  Hosted boards import chrome words from a private package. Third-party applications own their copy in code (or their
  message catalogs). The published SDK no longer imports or bundles that
  package.

  What stays on `@cavuno/board/format`: `formatSalaryRange` (`Intl`-backed
  amounts, wire `timeframe` enum, and a `bound` discriminant for open ranges),
  date helpers, `resolveCustomFieldDisplay`, `normalizeWebsiteUrl`,
  `buildJobBreadcrumbs` (kinds + data names; no `language`/`labels` args),
  `COUNTRY_CODES` / `countryOptions`, and the salary-stat formatters. Filter
  vocabularies (wire enums + parsers only) stay on `@cavuno/board/filters`.

- **Breaking:** `board.legal.retrieve`, the legal types (`PublicLegalPage`,
  `LegalPageType`, `LegalEntity`), and `GET /v1/boards/{identifier}/legal/{type}`
  (`getBoardLegal`) are removed. Legal prose is editor-authored
  application content, not a Board API concern.

- **Breaking:** `board.context().labels` is removed. Operator label overrides
  no longer ride the public Board API — applications own chrome words.
  Hosted storage for operator overrides is unchanged (hosted chrome still
  reads the bag).

  Before:

  ```json
  "labels": {
    "jobCardLabels": { "featuredLabel": "Top Job" },
    "navLabels": { "home": "Jobs" }
  }
  ```

  After: field absent.

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
