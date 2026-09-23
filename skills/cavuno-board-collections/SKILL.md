---
name: cavuno-board-collections
description: Custom profile fields and collection references with @cavuno/board. Use for rendering company, talent or job custom fields, collection entries, benefits/technologies/certification sections, or collection-backed filters.
---

# Custom fields and collections

An operator defines two kinds of extra data. A **custom field** stores one typed value directly on a company, talent profile, or job. A **collection reference** points that record at reusable entries — benefits, technologies, certifications, learning resources — that the operator maintains once and every record shares.

Hosted Cavuno boards do not render either one. The API resolves them and your frontend decides the layout, so this surface is read-heavy: definitions tell you what to draw, resolved selections tell you what to draw it with.

## The read model

Scalar values arrive opaque and keyed by field key; the labels, types, and select options live in a separate definition list. Never hard-code a label.

- Job definitions: `board.context()` → `customFields.job` (scalar) and `customFields.jobCollections` (collection fields).
- Company and talent definitions: `board.profileFields.retrieve('company' | 'candidate')` → `definitions` (scalar) and `referenceDefinitions` (collection fields).

To build an input form rather than a display, read `board.context().forms` (`job`, `company`, `talent`): the operator's field order with each custom and collection definition inlined, plus which fields are shown and required. `cavuno-board-post-a-job`, `cavuno-board-account`, and `cavuno-board-companies` show how to render each form.

A collection field definition carries `multiple`, and a multiple one may carry `maxSelections` — an operator-defined maximum, up to 100. Cap a picker at that number when it is present, at 100 when it is absent, and at one when `multiple` is false.

A job collection definition may also carry `allowOverrides` — each job can replace a selected entry's title and description — and `descriptionFieldKey`, the entry field whose value is the default description. Both are absent when the operator has not set them.

Resolved data rides on the detail responses:

```ts snippet
const context = await board.context();
const definitions = context.customFields.job;

const job = await board.jobs.retrieve('senior-chef');
job.customFieldValues.clearance;
job.resolvedCollectionFields;

const company = await board.companies.retrieve('acme');
company.customFieldValues.member_tier;
company.objectReferences;

const profile = await board.talent.retrieve('jane-doe');
profile.customFieldValues.available_for_mentoring;
profile.objectReferences;
```

A company or talent selection (`objectReferences[]`) carries `fieldKey`, `fieldLabel`, `recordId`, the entry's `slug` when it has one, a resolved `title` and optional `description`, optional `logoUrl`, the entry's own `fields` and `attributes`, and the record-specific `valueDefinitions` / `values` plus `entryDefinitions` / `entries`. `titleOverride` and `descriptionOverride` are present only when the profile replaced the shared wording — `title` and `description` are already resolved, so render those.

```ts snippet
const company = await board.companies.retrieve('acme');

for (const selection of company.objectReferences) {
  if (selection.fieldKey !== 'benefits') continue;
  renderBenefit({
    heading: selection.title,
    body: selection.description,
    logoUrl: selection.logoUrl,
    daysPerYear: selection.values.days_per_year,
  });
}
```

`values` holds one set of typed details for the selection. `entries` holds repeatable rows, each `{ key, values }` — several awards of one certification, for example. Both are `{}` / `[]` when the field defines no details.

Jobs use a different shape: `resolvedCollectionFields` is an array of `{ key, label, entries }`, and each entry is `{ id, name, slug?, logoUrl?, title, description, titleOverride, descriptionOverride, fields, values, references? }`. `title` and `description` are the entry's wording on this job, already resolved: the job's own wording when it set one, otherwise the entry `name` and the value of the definition's `descriptionFieldKey` field (`description` is `null` when neither exists). `titleOverride` and `descriptionOverride` hold the job's own wording, or `null` when the job uses the defaults. A job's wording is plain text; when the default description field is rich text, `description` is sanitised HTML with that wording escaped into paragraphs, so insert `description` as HTML only in that case. Jobs have no per-selection details or repeatable rows.

```ts snippet
const job = await board.jobs.retrieve('senior-chef');

for (const field of job.resolvedCollectionFields) {
  for (const entry of field.entries) {
    renderChip({
      label: entry.title,
      description: entry.description,
      logoUrl: entry.logoUrl,
      group: field.label,
    });
  }
}
```

Visibility is enforced server-side. Public reads return only public scalar fields, public collection fields, and active entries; private definitions and archived entries are omitted entirely, not nulled. Do not render a placeholder for a key that is absent — the operator meant it to be invisible. An owner read returns the private owner-editable fields too, so the same component can receive either payload; branch on what is present.

## Owner writes

Collection creation, entry mutation, and imports are operator API operations and are not on this SDK. A signed-in candidate or approved company member edits their own selections through `board.me`, where a selection update replaces the whole editable set and a scalar update is additive. Those read-modify-write rules, the choice search, and the repeatable-entry `key` contract live in `cavuno-board-account` — follow that skill for any write.

An approved company member sets a job's own wording with `collectionOverrides` on `board.me.companies.jobs.create` / `update`: one `{ fieldKey, recordId, title?, description? }` per selected entry, only on a field whose definition has `allowOverrides`. `cavuno-board-post-a-job` shows the form.

## Rendering

- Take every label from the definition list (`referenceDefinitions[].label`, `definitions[].label`, `fieldLabel`, `field.label`), never from the key.
- Render in the order the API returns. Definitions are in operator display order and selections follow the record's order; do not re-sort.
- Resolve a select value through the definition's `options[].key` → `label`. A stored value is an option key, or an array of them for multi-select.
- Media attributes are already metadata objects: `{ id, name, contentType, sizeBytes, url }`. An `image` or `file` attribute is one object, an `image_gallery` attribute is an array. Load by the returned `url`; never build a URL yourself.
- `logoUrl` is optional on a selection, a job collection entry, and a choice row. The operator gives a collection a logo by adding an `image` field and marking it as the logo; `logoUrl` is that image's URL for the entry (older entries may instead carry a logo URL saved before logos were image fields). When present it is the entry's own logo — render it directly, loading it like any other media `url`, rather than keeping a second name-to-logo map, and fall back to initials or nothing when it is absent. The logo image may also appear among the entry's `attributes`; do not render it twice.
- A `rich_text` value is sanitised HTML from the server. Insert it as HTML; do not re-escape it into visible tags and do not run a second markdown pass over it.
- `references` on an entry is keyed by the reference field's key and always holds an array, even for a single reference.
- Build an entry URL from its `slug`, never from `name` or `id`. A slug is URL-safe and unique within one collection only, so keep the collection or field in the path (`/benefits/annual-leave`). Renaming an entry keeps its slug; when the operator changes a slug, the previous one stays reserved for that entry. `slug` is on selections, job collection entries, nested `references`, and choice rows, and can be absent on entries saved before slugs existed — fall back to a non-linked render then.
- Number, boolean, and date values keep their JSON types. `0` and `false` are real values — test for `undefined`, not falsiness.

## Filters

Public collection entries are filter values. Company and talent search accept `objectReferences: [{ key, recordIds }]`; job, company, and talent search accept `customFields: [{ key, values }]`. Load the options first and submit the returned record `id`.

```ts snippet
const choices = await board.profileFields.choices('company', 'technologies', {
  search: 'typescript',
  limit: 20,
});

const companies = await board.companies.search({
  objectReferences: [
    { key: 'technologies', recordIds: [choices.data[0]!.id] },
  ],
});

const talent = await board.talent.list({
  objectReferences: [
    { key: 'certifications', recordIds: [choices.data[0]!.id] },
  ],
});

const jobChoices = await board.jobs.collectionChoices('tech_stack', {
  limit: 20,
});

void companies.data;
void talent.data;
void jobChoices.data;
```

Clause and cursor rules, the `invalid_filter` cases, and the listing-URL contract belong to `cavuno-board-filters`.

## Completion gate

Finish only after every applicable check passes:

- Every rendered label comes from a definition or a resolved `fieldLabel`, and no key is displayed raw.
- Select values render as their option label, and `0` / `false` survive to the screen.
- A selection or job collection entry renders its resolved `title` and `description`, so an overridden entry shows the record's wording and a non-overridden one shows the collection default.
- Media renders from the returned `url`, an `image_gallery` renders every image, and a missing `logoUrl` degrades without a broken image.
- Rich text renders as formatted HTML, not escaped tags.
- A private field and an archived entry are absent from the public render, with no empty placeholder left behind.
- Job pages read `resolvedCollectionFields`, and company or talent pages read `objectReferences` — neither shape is assumed for the other.
- Filter requests carry record IDs from a choices call, and the filter control's options come from the public definition list.
- A multi-select picker stops at the definition's `maxSelections`, or at 100 when the definition omits it.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
