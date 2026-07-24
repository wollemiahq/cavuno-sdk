// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. `PublicLegalPage` aliases the generated component;
// `LegalEntity` is derived from it. `LegalPageType` (the `{type}` path enum)
// stays hand-written — it's an input enum, not a response component.
import type { Schemas } from './_spec';

/**
 * A board legal/about page. The
 * API serves owner-authored prose as portable HTML; the starter authors the
 * layout + JSON-LD. Impressum additionally carries structured legal-entity
 * facts and is gated by the board's `impressumEnabled` flag (404 when off).
 */
export type LegalPageType =
  | 'terms-of-service'
  | 'privacy-policy'
  | 'cookie-policy'
  | 'about'
  | 'impressum';

export type PublicLegalPage = Schemas['LegalPage'];

export type LegalEntity = NonNullable<PublicLegalPage['legalEntity']>;
