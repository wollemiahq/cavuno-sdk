---
name: cavuno-board-applications
description: Candidate application handoff with @cavuno/board. Use for native or guest apply, application tracking, resume attachment, withdrawal, and saved jobs.
---

# Candidate application handoff

Treat applying as a handoff: submission belongs to `board.jobs`; the resulting candidate record belongs to `board.me`. The `me.*` side requires a board-user bearer token. See `cavuno-board-auth` for authentication.

External jobs expose `applicationUrl`; link to it instead of creating a native application. Employer pipeline work belongs to `board.me.companies.applicants.*`.

The host application owns apply forms and file-pickers; the SDK owns submission data operations.

## Submit

`jobs.apply` is optional-auth and idempotent. A signed-in candidate supplies at most `coverNote`; a guest supplies `name` and `email`, when the board permits guest applications.

```ts snippet
const application = await board.jobs.apply('senior-chef', {
  coverNote: 'Excited to cook here.',
});

const guestApplication = await board.jobs.apply('senior-chef', {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
});
```

Guest applications are claimed through the server-driven magic-link flow; the SDK has no guest-claim method.

## Attach a resume

Pass the `Blob` or `File`; the SDK builds multipart `FormData`. A signed-in candidate targets their own application. A guest must pass the id returned by `apply`.

```ts snippet
await board.jobs.uploadApplicationResume('senior-chef', file);
await board.jobs.uploadApplicationResume('senior-chef', file, {
  applicationId: guestApplication.id,
});
```

This step is complete when the returned application has `resumeFilename` set.

## Derive the apply-button state

`jobs.myApplication` returns the signed-in candidate's application and throws a 404 when none exists. Derive the UI from that result rather than a local submitted flag.

```ts snippet
import { isNotFound } from '@cavuno/board';

try {
  const mine = await board.jobs.myApplication('senior-chef');
  renderApplicationStatus(mine.status);
} catch (error) {
  if (!isNotFound(error)) throw error;
  renderApplyForm();
}
```

`Application.status` is a polled candidate-facing projection of the employer stage: `'applied' | 'interviewing' | 'negotiation' | 'hired' | 'archived'`. Its `job` may be null after job removal.

## Track and manage applications

```ts snippet
const page = await board.me.applications.list({ limit: 20 }); // newest first
const application = await board.me.applications.retrieve(applicationId);

await board.me.applications.updateFacts(applicationId, {
  coverNote: 'Updated after our call.',
});

await board.me.applications.withdraw(applicationId);
```

`updateFacts` merge-patches `candidateName`, `candidateEmail`, `candidateHeadline`, `candidateLocation`, and `coverNote`. `withdraw` permanently deletes the application, so obtain explicit confirmation first.

## Save jobs

Saved rows embed the same slim `PublicJobCard` as the jobs list — render them
with the same card view-model, and do not expect full-job fields (description,
custom field values) on saved rows. `save` converges on the existing row and
`unsave` is idempotent.

```ts snippet
const saved = await board.me.savedJobs.list({ limit: 20 });
saved.data[0]?.job.title;

await board.me.savedJobs.save({ jobId: job.id });
await board.me.savedJobs.unsave(job.id);
```

## Completion gate

- Signed-in submission omits name and email; guest submission includes both.
- Repeating `apply` returns the same application id.
- Resume upload returns an application with `resumeFilename`.
- `myApplication` plus `isNotFound` drives the apply-button state.
- Re-fetching after withdrawal removes the application.
- Repeating `unsave` leaves the saved list consistent.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
