// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. `PublicBoard` aliases the generated board-context
// component; the nested feature and analytics shapes are derived from it.
//
// `PublicBoardAnalytics` includes Meta (`metaPixelId`) plus LinkedIn Insight
// Tag (`linkedInPartnerId`) and per-event Campaign Manager conversion IDs
// (`linkedInConversionSignUpId`, `linkedInConversionLoginId`,
// `linkedInConversionApplyClickId`, `linkedInConversionApplySubmitId`,
// `linkedInConversionJobAlertSubscribeId`) for headless dual-path conversion
// tracking.
import type { Schemas } from './_spec';

export type PublicBoard = Schemas['PublicBoardContext'];
export type PublicBoardFeatures = PublicBoard['features'];
export type PublicBoardAnalytics = PublicBoard['analytics'];
export type PublicBoardAds = PublicBoard['ads'];
export type PublicBoardJobForm = PublicBoard['jobForm'];

/**
 * The operator's job, company and talent forms from
 * `board.context().forms`: one ordered field list per form. Render each list
 * in order, skip entries with `visible: false`, draw built-ins by `key` with
 * your own controls, and draw custom and collection fields from their inlined
 * `definition`. A locked built-in is always shown and required.
 */
export type BoardFormLayout = PublicBoard['forms'];
/** One entry of `forms.job`: a built-in, a custom field or a collection field. */
export type BoardJobFormField = Schemas['BoardJobFormField'];
/** One entry of `forms.company` or `forms.talent`. */
export type BoardProfileFormField = Schemas['BoardProfileFormField'];
/** Any form entry, from any of the three forms. */
export type BoardFormField = BoardJobFormField | BoardProfileFormField;
/** A built-in form entry, identified by `key`. */
export type BoardFormBuiltinField = Schemas['BoardFormBuiltinField'];
/** Why a built-in is locked; `null` on an unlocked built-in. */
export type BoardFormLockReason = Schemas['FormFieldLockReason'];

/**
 * An operator-defined custom field definition. Board-wide and
 * model-scoped under `board.context().customFields` (today only `job`);
 * use it to render and localize a record's opaque `customFieldValues`
 * (resolve option `key`s → labels, honour field `type` and display order).
 * Shared with the Operator API's custom-field surface (one canonical schema).
 */
export type CustomFieldDefinition = Schemas['CustomFieldDefinition'];
export type CustomFieldType = CustomFieldDefinition['type'];
export type CustomFieldOption = Schemas['CustomFieldOption'];
