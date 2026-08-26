---
name: cavuno-board-account
description: Candidate self-service boundary with @cavuno/board. Use for account, profile, resume onboarding, recommended jobs, avatar, experience, education, skills, languages, or notification preferences.
---

# Candidate self-service boundary

Signed-in candidate data lives under `board.me`. Browser calls use the bearer token in `auth.storage`; server calls pass it per request in `options.headers`. See `cavuno-board-auth` for cookie-based server sessions.

Anonymous methods here are token-based email unsubscribe and email-change confirm (`confirmEmailChange`). Applications, employer companies, messaging, and alerts have their own skills.

The host application owns forms, file pickers, and cookie plumbing; this SDK surface supplies data operations.

## Account and profile

Account deletion is a synchronous, irreversible cascade over the profile, collections, saved jobs, alerts, avatar, and resume. Obtain explicit confirmation before calling it.

Change the password with the current password. The SDK persists the returned session so the caller stays signed in. Passwordless accounts (magic-link or OAuth) get `no_password` — send them through `auth.forgotPassword` instead.

```ts snippet
const me = await board.me.retrieve();
await board.me.delete();

await board.me.updatePassword({
  currentPassword: 'oldpass99',
  newPassword: 'newpass99',
});

await board.me.requestEmailChange({ email: 'new@example.com' });
await board.me.confirmEmailChange({ token });

const profile = await board.me.profile.retrieve();
await board.me.profile.update({
  headline: 'Staff Engineer',
  jobSearchStatus: 'open_to_offers',
  profileVisibility: 'public',
});

const { available } = await board.me.profile.handleAvailable('jane');
```

Profile updates are merge-patches. Handle availability is advisory—your current handle counts as available—and the write re-checks uniqueness.

## Experience and education

Both collections are id-keyed CRUD with merge-patch updates. Experience creation requires `title`, `companyName`, and `startDate`; education creation requires `institutionName`.

```ts snippet
const page = await board.me.profile.listExperience();
const experience = await board.me.profile.createExperience({
  title: 'Staff Engineer',
  companyName: 'Acme',
  startDate: '2022-01',
});
await board.me.profile.updateExperience(experience.id, {
  endDate: '2025-06',
});
await board.me.profile.deleteExperience(experience.id);

const education = await board.me.profile.createEducation({
  institutionName: 'Example University',
});
await board.me.profile.listEducation();
await board.me.profile.updateEducation(education.id, {});
await board.me.profile.deleteEducation(education.id);
```

## Full-set fields

`updateSkills` and `updateLanguages` replace the whole ordered set. Read-modify-write any value the user intends to retain.

```ts snippet
const current = await board.me.profile.listSkills();
await board.me.profile.updateSkills({
  skills: [...current.data.map((skill) => skill.name), 'TypeScript'],
});

await board.me.profile.updateLanguages({
  languages: [{ name: 'English', proficiency: 'native' }],
});
```

Both updates return the complete updated list.

## Files

The SDK builds multipart `FormData` with field `file` from a `Blob` or `File`. Avatar uploads accept JPEG, PNG, or WebP up to 5 MB.

```ts snippet
const { avatarUrl } = await board.me.profile.uploadAvatar(file);
```

Resume upload starts an asynchronous parse that may populate the profile. Poll within a fixed budget, surface failure, and keep manual editing available if parsing runs long.

```ts snippet
let resume = await board.me.resume.upload(file, {
  keepResumeOnFile: true,
});

const maxPolls = 30;
for (let poll = 0; resume.parseStatus === 'parsing' && poll < maxPolls; poll++) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  resume = await board.me.resume.retrieve();
}

if (resume.parseStatus === 'parsed') {
  await board.me.profile.retrieve();
} else if (resume.parseStatus === 'failed') {
  showParseFailure(resume.parseFailureReason);
} else {
  showDelayedParseState();
}
```

Upload options also include `importMode: 'append_only' | 'replace_all'` and `confirmReplaceAll`. `resume.file.url` is a short-lived signed URL. `parseStatus` is null before any parse. `board.me.resume.delete()` removes the stored file and keep-on-file consent while retaining imported profile fields.

## Recommended jobs

`board.me.recommendedJobs.list` is the sibling of `savedJobs.list`. Each item wraps the same slim `PublicJobCard` (`{ object: 'recommended_job', job }`). Order is the ranking. The endpoint never returns scores, weights, or ranker identity.

Cold start is an empty list — no hint field. Drive an upload-resume CTA from `board.me.profile` / `board.me.resume` (`parseStatus`, skills), not from the list response.

```ts snippet
const { data } = await board.me.recommendedJobs.list({ limit: 20 });
data[0]?.job.title;

const profile = await board.me.profile.retrieve();
const skills = await board.me.profile.listSkills();
const resume = await board.me.resume.retrieve();
if (data.length === 0 && (skills.data.length === 0 || resume.parseStatus !== 'parsed')) {
  promptResumeUpload();
}
```

## Notification preferences

Authenticated settings expose `messageEmails`, `applicationEmails`, and
`recommendedJobEmails`. The first two default subscribed when no stored
preference exists; recommendation email is explicit opt-in and defaults
unsubscribed. Each preference includes additive `waitlisted`. Updating
one channel returns the full set. A subscribe at the Email subscribers
cap waitlists instead of failing.

```ts snippet
const preferences = await board.me.notificationPreferences.retrieve();
await board.me.notificationPreferences.update({
  channel: 'messageEmails',
  subscribed: false,
});
```

Email links use an anonymous HMAC token as authorization. Read all three inputs from the link query:

```ts snippet
await board.me.notificationPreferences.unsubscribeWithToken({
  boardUserId,
  channel: 'applicationEmails',
  token,
});
```

## Completion gate

- Profile update is visible after retrieval.
- Adding a skill preserves every existing skill.
- Uploaded `avatarUrl` renders.
- Resume parsing reaches `parsed`, reports `parseFailureReason`, or reaches the explicit delayed state without blocking editing.
- Recommended jobs render the returned cards in list order; an empty list plus missing skills / unparsed resume shows an upload-resume prompt.
- Anonymous unsubscribe works in a logged-out browser.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
