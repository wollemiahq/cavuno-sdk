import type { Schemas } from './_spec';

/** A short-lived opaque hand-off to the dedicated Apply gateway. */
export type ApplyIntent = Schemas['ApplyIntent'];

/** Duplicate-click session key; it must not contain profile or other PII. */
export type CreateApplyIntentBody = Schemas['CreateApplyIntentBody'];
