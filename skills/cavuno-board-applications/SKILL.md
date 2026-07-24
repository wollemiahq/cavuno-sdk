---
name: cavuno-board-applications
description: The native apply flow with the @cavuno/board SDK — jobs.apply (signed-in or guest), attaching a resume via jobs.uploadApplicationResume, the jobs.myApplication "have I applied?" check, managing submitted applications (me.applications list/retrieve/updateFacts/withdraw), and saved jobs (me.savedJobs). Use when building an apply form, an application-tracker page, or a save-job button.
---

# Apply flow and application tracking

Apply lives on the job (`board.jobs.apply` — optional-auth); everything after submission lives under `board.me.applications` (bearer token required, see `cavuno-board-auth`). Saved jobs follow the same authenticated pattern.

## When to use

- The apply form on a job page (native apply, signed-in or guest).
- Attaching a resume to an application.
- "My applications" tracker: list, detail, edit facts, withdraw.
- Save/unsave-job buttons and the saved-jobs page.

## When not to use

- Jobs whose `applicationUrl` points off-board (external apply) — just link out.
- The employer's pipeline view of the same data (`me.companies.applicants.*`).
- Candidate profile/resume self-service — `cavuno-board-account`.

Out of scope — do not invent exports: the SDK provides no apply-form components, file-picker UI, or auth cookie plumbing — the host app owns those. There is also **no guest-claim method** on the SDK: after a guest signs up, their applications are associated via a server-driven magic-link email flow, not an SDK call.

## Submit an application

`jobs.apply` is optional-auth on one URL. Signed in, name/email derive from the candidate profile — send at most a `coverNote`. A guest supplies `name` + `email` (allowed only when the board permits applying without sign-up; otherwise the call fails). Idempotent — a repeat apply returns the existing application.

```ts snippet
// Signed-in candidate:
const application = await board.jobs.apply('senior-chef', {
  coverNote: 'Excited to cook here.',
});

// Guest (board must allow applications without sign-up):
const guestApp = await board.jobs.apply('senior-chef', {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
});
```

## Attach a resume

A separate multipart call — pass a `Blob`/`File`; the SDK builds the `FormData`. A signed-in candidate targets their own application for the job; a guest passes the `applicationId` returned by `apply`. Returns the updated application (`resumeFilename` set).

```ts snippet
// Signed-in:
await board.jobs.uploadApplicationResume('senior-chef', file);
// Guest:
await board.jobs.uploadApplicationResume('senior-chef', file, {
  applicationId: guestApp.id,
});
```

## "Have I applied?" — the apply-button state

`jobs.myApplication` returns the authenticated candidate's application for the job, and **throws a 404 `BoardApiError` when there is none** — branch with `isNotFound`:

```ts snippet
import { isNotFound } from '@cavuno/board';

try {
  const mine = await board.jobs.myApplication('senior-chef');
  // already applied — show status instead of the apply button
} catch (err) {
  if (!isNotFound(err)) throw err;
  // not applied yet — show the apply form
}
```

## Application status — polled, not realtime

`Application.status` is a coarse candidate-facing state **derived from the employer's pipeline stage**: `'applied' | 'interviewing' | 'negotiation' | 'hired' | 'archived'`. It changes server-side as the employer moves the applicant — the surface is plain REST, so re-fetch to observe updates; nothing pushes to the client. `job` on the application is nullable (the job may have been removed).

## Manage my applications

```ts snippet
const { data, nextCursor } = await board.me.applications.list({ limit: 20 }); // newest first
const app = await board.me.applications.retrieve(applicationId);

// Merge-patch the candidate-facing facts — only while still editable:
await board.me.applications.updateFacts(applicationId, {
  coverNote: 'Updated after our call.',
});

await board.me.applications.withdraw(applicationId); // 204 — permanently deletes
```

`updateFacts` accepts `candidateName`, `candidateEmail`, `candidateHeadline`, `candidateLocation`, `coverNote` (all optional). Withdraw is permanent deletion, not a status flip — confirm before calling.

## Saved jobs — the adjacent pattern

Same authenticated `me.*` shape. Each saved row embeds the full `PublicJob`, so the saved-jobs page renders without extra fetches.

```ts snippet
const saved = await board.me.savedJobs.list({ limit: 20 });
saved.data[0]?.job.title; // full PublicJob embedded

await board.me.savedJobs.save({ jobId: job.id }); // converges — re-saving returns the same row
await board.me.savedJobs.unsave(job.id); // idempotent — unknown ids still 204
```

## Verify

- [ ] Signed-in apply sends no name/email; guest apply sends both.
- [ ] A second apply to the same job returns the same application id (no duplicate).
- [ ] After `uploadApplicationResume`, the application's `resumeFilename` is set.
- [ ] The apply button flips state via `myApplication` + `isNotFound`, not a local flag.
- [ ] Withdraw removes the row from `me.applications.list` on re-fetch.
- [ ] Unsave leaves the saved-jobs list consistent even when clicked twice.
