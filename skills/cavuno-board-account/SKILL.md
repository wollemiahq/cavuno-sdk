---
name: cavuno-board-account
description: Candidate self-service boundary with @cavuno/board. Use for account, profile, custom profile fields, collection selections, resume onboarding, recommended jobs, avatar, experience, education, skills, languages, or notification preferences.
---

# Candidate self-service boundary

Signed-in candidate data lives under `board.me`. Browser calls use the bearer token in `auth.storage`; server calls pass it per request in `options.headers`. See `cavuno-board-auth` for cookie-based server sessions.

Anonymous methods here are token-based email unsubscribe and email-change confirm (`confirmEmailChange`). Applications, employer companies, messaging, and alerts have their own skills.

The host application owns forms, file pickers, and cookie plumbing; this SDK surface supplies data operations.

## Candidate screens are candidate-only

A board user is either a candidate or an employer (`me.role`). Only candidates have a candidate profile. Render candidate screens and fields (the profile form, profile completeness, resume upload, experience, education, skills, and languages) only when `me.role === 'candidate'`. On the account page, give an employer account the employer profile view instead: avatar, `displayName` (the one profile field every account can update), and a link to the employer screens (`board.me.companies.*`). Never show them the empty candidate form.

The API is the backstop: a profile write from an account with no candidate profile returns 403 `candidate_profile_required` before anything is saved. `displayName` alone is the one profile field every account can update. Surface this error as a message; never swallow it and report "Saved".

```ts snippet
import { isBoardApiError } from '@cavuno/board';

const me = await board.me.retrieve();
if (me.role !== 'candidate') {
  return renderEmployerProfile(me); // avatar, displayName, link to employer screens
}

try {
  await board.me.profile.update({ headline: 'Staff Engineer' });
  showSaved();
} catch (error) {
  if (isBoardApiError(error) && error.code === 'candidate_profile_required') {
    return showError('Only candidate accounts have a candidate profile.');
  }
  throw error;
}
```

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

## Render the profile form from the operator's layout

`board.context().forms.talent` is the candidate profile form as one ordered list, set by the operator. Render it in order and skip entries with `visible: false`. Each entry has `required`; validate it in the form before saving.

```ts snippet
const { forms } = await board.context();

for (const field of forms.talent) {
  if (!field.visible) continue;
  if (field.kind === 'builtin') {
    renderProfileBuiltin(field.key, { required: field.required });
  } else if (field.definition.editableByOwner) {
    renderProfileField(field, { required: field.required });
  }
}
```

Built-in keys map to the methods below: `name` → `displayName` and `headline`, `location`, `jobSearchStatus`, `bio` → `profile.update`; `email` → `requestEmailChange`; `avatar` → `uploadAvatar`; `experience` and `education` → their CRUD methods; `skills` and `languages` → `updateSkills` / `updateLanguages`. `name` and `email` are locked (always shown and required). Skip a built-in key you do not recognise.

`custom` entries are scalar profile fields (`updateCustomFields`) and `collection` entries are collection fields (`updateObjectReferences`); both carry their public `definition` inline. Render only definitions with `editableByOwner: true` as inputs. The layout lists public fields only; private owner-editable fields come from `retrieveCustomFields` and `retrieveObjectReferences` below. A collection definition with `required: true` needs at least one selection while shown.

## Custom fields and collection selections

Scalar custom-field updates are additive. Render controls from the returned definitions, preserve their value types, and send only owner-editable keys. Omitted keys remain unchanged.

Collection-selection updates replace the complete editable set. Read before writing when the user means to retain existing selections. Each resolved selection includes its display title, optional description and logo, shared attributes, and profile-specific details. Use `listObjectReferenceChoices` to search the active choices for one editable field; do not guess record IDs from names.

```ts snippet
const customFields = await board.me.profile.retrieveCustomFields();
await board.me.profile.updateCustomFields({
  values: { membership_number: 'A-1234' },
});

const references = await board.me.profile.retrieveObjectReferences();
const choices = await board.me.profile.listObjectReferenceChoices(
  'certifications',
  { search: 'professional', limit: 20 });
await board.me.profile.updateObjectReferences({
  selections: [
    ...references.selections
      .filter((selection) => selection.fieldKey !== 'certifications')
      .map(({ fieldKey, recordId, values, entries }) => ({
        fieldKey,
        recordId,
        values,
        entries,
      })),
    {
      fieldKey: 'certifications',
      recordId: choices.data[0]!.id,
    },
  ],
});
```

Approved company members use the parallel company methods. The company slug comes before the body or field key.

```ts snippet
const companyFields = await board.me.companies.retrieveCustomFields('acme');
await board.me.companies.updateCustomFields('acme', {
  values: { founded_year: 2018 },
});

const companyReferences =
  await board.me.companies.retrieveObjectReferences('acme');
const technologies =
  await board.me.companies.listObjectReferenceChoices(
    'acme',
    'technologies',
    { search: 'typescript', limit: 20 });
await board.me.companies.updateObjectReferences('acme', {
  selections: [
    ...companyReferences.selections
      .filter((selection) => selection.fieldKey !== 'technologies')
      .map(({ fieldKey, recordId, values, entries }) => ({
        fieldKey,
        recordId,
        values,
        entries,
      })),
    {
      fieldKey: 'technologies',
      recordId: technologies.data[0]!.id,
      values: { years: 4 },
    },
  ],
});
```

Collection creation, collection entry mutation, and bulk imports are operator API operations. Keep that API key on the server; the Board SDK intentionally exposes only public discovery and signed-in owner reads and writes.

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

- Candidate screens render only for `me.role === 'candidate'`; an employer account gets the employer profile view (avatar, `displayName`, link to employer screens).
- A `candidate_profile_required` 403 shows an error and never a "Saved" state.
- The profile form follows `forms.talent`: order matches, hidden fields are absent, and required fields block save while empty.
- Profile update is visible after retrieval.
- Scalar field updates preserve omitted values; collection selection updates preserve every selection the user meant to keep.
- Choice searches use the returned record `id`, and an optional returned `logoUrl` renders without a separate logo map.
- Adding a skill preserves every existing skill.
- Uploaded `avatarUrl` renders.
- Resume parsing reaches `parsed`, reports `parseFailureReason`, or reaches the explicit delayed state without blocking editing.
- Recommended jobs render the returned cards in list order; an empty list plus missing skills / unparsed resume shows an upload-resume prompt.
- Anonymous unsubscribe works in a logged-out browser.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
