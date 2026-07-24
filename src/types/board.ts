// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. `PublicBoard` aliases the generated board-context
// component; the nested feature/analytics/theme shapes are derived from it.
import type { Schemas } from './_spec';

export type PublicBoard = Schemas['PublicBoardContext'];
export type PublicBoardFeatures = PublicBoard['features'];
export type PublicBoardAnalytics = PublicBoard['analytics'];
export type PublicBoardTheme = NonNullable<PublicBoard['theme']>;
/**
 * The operator label-override bag — open on the wire; consumers
 * hand it to `uiCopy(language, labels)` / the registry blocks' `labels`
 * prop, which type it as the closed `BoardLabelOverrides` group set from
 * `@cavuno/board/format`.
 */
export type PublicBoardLabels = PublicBoard['labels'];

/**
 * An operator-defined custom job-field definition. Board-wide;
 * use it to render and localize a job's opaque `customFieldValues` (resolve
 * option `key`s → labels, honour field `type` and display order). Shared with
 * the Operator API's custom-field surface (one canonical schema).
 */
export type CustomFieldDefinition = Schemas['CustomFieldDefinition'];
export type CustomFieldType = CustomFieldDefinition['type'];
export type CustomFieldOption = Schemas['CustomFieldOption'];
