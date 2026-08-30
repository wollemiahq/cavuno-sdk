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
 * An operator-defined custom field definition. Board-wide and
 * model-scoped under `board.context().customFields` (today only `job`);
 * use it to render and localize a record's opaque `customFieldValues`
 * (resolve option `key`s → labels, honour field `type` and display order).
 * Shared with the Operator API's custom-field surface (one canonical schema).
 */
export type CustomFieldDefinition = Schemas['CustomFieldDefinition'];
export type CustomFieldType = CustomFieldDefinition['type'];
export type CustomFieldOption = Schemas['CustomFieldOption'];
