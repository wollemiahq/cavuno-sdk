---
name: cavuno-board-account
description: Candidate account self-service with the @cavuno/board SDK — me.retrieve/delete, the candidate profile (merge-patch update, handle availability), experience/education CRUD, skills/languages full-replace, avatar upload, resume upload with async parse polling, and notification preferences plus the anonymous token unsubscribe. Use when building account, profile-edit, onboarding, or notification-settings pages for a signed-in board user.
---

# Candidate account self-service

Everything the signed-in candidate manages about themselves lives under `board.me`. Every call here requires a board-user bearer token — in the browser the SDK reads it from `auth.storage` after login; on the server pass it per call via `options.headers` (see `cavuno-board-auth` for the httpOnly-cookie pattern). The one exception is the anonymous token unsubscribe at the end.

## When to use

- Account page: show the signed-in user, delete the account.
- Profile editor: bio/headline/handle, experience, education, skills, languages, avatar.
- Resume-driven onboarding (upload → parse → auto-populated profile).
- Email notification settings + the unsubscribe link in emails.

## When not to use

- Login/registration/tokens — `cavuno-board-auth`.
- Applications and saved jobs — `cavuno-board-applications`.
- The employer facet (`me.companies.*`), messaging (`me.conversations.*`), job alerts (`me.alerts.*`).

Out of scope — do not invent exports: the SDK ships no form components, file-picker UI, or upload widgets; the host app owns all UI and cookie plumbing.

## Account: retrieve and delete

```ts snippet
const me = await board.me.retrieve(); // the authenticated BoardUser
await board.me.delete(); // 204 — synchronous, irreversible cascade
```

`delete` removes the account and all dependent data (profile, collections, saved jobs, alerts, avatar/resume files). Gate it behind an explicit confirmation.

## Profile: retrieve, update, handle availability

The profile is a singleton. `update` is a merge-patch — omitted fields stay unchanged.

```ts snippet
const profile = await board.me.profile.retrieve();
profile.handle; profile.headline; profile.jobSearchStatus;

await board.me.profile.update({
  headline: 'Staff Engineer',
  jobSearchStatus: 'open_to_offers',
  profileVisibility: 'public',
});

const { available } = await board.me.profile.handleAvailable('jane');
```

`handleAvailable` is advisory (my current handle counts as available); `update` re-checks on write.

## Experience and education: per-entry CRUD

Both collections are id-keyed CRUD; updates are merge-patch. `createExperience` requires `title`, `companyName`, `startDate`; `createEducation` requires `institutionName`.

```ts snippet
const { data: entries } = await board.me.profile.listExperience();
const entry = await board.me.profile.createExperience({
  title: 'Staff Engineer',
  companyName: 'Acme',
  startDate: '2022-01',
});
await board.me.profile.updateExperience(entry.id, { endDate: '2025-06' });
await board.me.profile.deleteExperience(entry.id);
// Education mirrors this: listEducation / createEducation /
// updateEducation(id, body) / deleteEducation(id).
```

## Skills and languages: PUT full-replace

`updateSkills` / `updateLanguages` replace the **whole set** — there is no add/remove-one endpoint. Sending only the new item wipes the rest. Round-trip the current list:

```ts snippet
const current = await board.me.profile.listSkills();
await board.me.profile.updateSkills({
  skills: [...current.data.map((s) => s.name), 'TypeScript'], // ordered names
});

await board.me.profile.updateLanguages({
  languages: [{ name: 'English', proficiency: 'native' }],
});
```

Both return the full updated list envelope, so you can render straight from the response.

## Avatar upload

Pass a `Blob`/`File` — the SDK builds the multipart `FormData` (field `file`). JPEG/PNG/WebP, ≤ 5 MB.

```ts snippet
const { avatarUrl } = await board.me.profile.uploadAvatar(file);
```

## Resume: upload, then poll the parse

`upload` starts an **async parse** that auto-populates the profile. It returns the resume with `parseStatus: 'parsing'` — poll `retrieve()` until `parsed` or `failed`, then re-read `profile.*` for the populated fields. Options: `keepResumeOnFile`, `importMode: 'append_only' | 'replace_all'`, `confirmReplaceAll`.

```ts snippet
let resume = await board.me.resume.upload(file, { keepResumeOnFile: true });
// Bounded poll — a stuck parse job must not hang the UI forever.
const MAX_POLLS = 30; // ~60s at 2s cadence
for (let i = 0; resume.parseStatus === 'parsing' && i < MAX_POLLS; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  resume = await board.me.resume.retrieve();
}
if (resume.parseStatus === 'parsed') {
  const profile = await board.me.profile.retrieve(); // auto-populated
} else if (resume.parseStatus === 'failed') {
  resume.parseFailureReason; // surface it
} else {
  // still 'parsing' after the window: show "taking longer than usual",
  // keep the manual profile editor usable — never block on the parse.
}
```

`resume.file` holds the stored file (`url` is a short-lived signed download URL). `parseStatus` is `null` when no parse has run. `board.me.resume.delete()` removes the stored file and withdraws keep-on-file consent — parsed profile fields stay.

## Notification preferences + anonymous unsubscribe

Two channels today: `messageEmails` and `applicationEmails`. `update` toggles one and returns the full updated set.

```ts snippet
const { data: prefs } = await board.me.notificationPreferences.retrieve();
await board.me.notificationPreferences.update({
  channel: 'messageEmails',
  subscribed: false,
});
```

The one-click unsubscribe link in emails is **anonymous** — no session; the HMAC token is the authorization. All three fields come from the link's query string; resolves void (204):

```ts snippet
await board.me.notificationPreferences.unsubscribeWithToken({
  boardUserId,
  channel: 'applicationEmails',
  token,
});
```

## Verify

- [ ] A profile `update` followed by `retrieve` shows the new field values.
- [ ] Adding a skill preserves the existing ones (the full-replace round-trip is in place).
- [ ] After `uploadAvatar`, the returned `avatarUrl` renders.
- [ ] Resume upload reaches `parsed` (or surfaces `failed` + `parseFailureReason`), and the profile shows parsed data.
- [ ] The email unsubscribe link works in a logged-out browser.
