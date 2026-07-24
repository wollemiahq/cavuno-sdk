// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts.
import type { Schemas } from './_spec';

/**
 * The board-access grant returned by `password.verify()`. Send `token` as
 * the `X-Board-Access` header on content reads to pass a board's password
 * wall (the SDK does this automatically once the grant is stored).
 */
export type BoardAccessGrant = Schemas['BoardAccessGrant'];
