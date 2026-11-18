// MCP consent page types. Response and body entities alias the generated
// OpenAPI components.
import type { Schemas } from './_spec';

/**
 * What the consent page does next (`mcpConsent.get`): show the consent,
 * send the person to sign in or verify their email, redirect to the
 * assistant, or show an error.
 */
export type McpConsentStep = Schemas['BoardMcpConsentStep'];

/** Body for `mcpConsent.submit`: Allow or Cancel on the step shown. */
export type McpConsentDecisionBody = Schemas['BoardMcpConsentDecisionBody'];

/** The step after Allow or Cancel (`mcpConsent.submit`). */
export type McpConsentDecision = Schemas['BoardMcpConsentDecision'];
