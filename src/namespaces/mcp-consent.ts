import type { BoardClient, FetchOptions } from '../client';
import type {
  McpConsentDecision,
  McpConsentDecisionBody,
  McpConsentStep,
} from '../types/mcp-consent';

export function mcpConsentNamespace(client: BoardClient) {
  return {
    /**
     * The next step of the consent page, where a person lets an AI
     * assistant connect to their account on the board's MCP server. Pass
     * the page's query string unchanged; send the visitor's session bearer
     * when they are signed in. Answers only on the board's own live site,
     * where sign-in from assistants is on; anywhere else it is a 404.
     *
     * The query is a string, not an object, because the API treats a
     * repeated parameter as a broken link, which an object would hide.
     *
     * @example
     * const step = await board.mcpConsent.get(new URL(request.url).search, {
     *   headers: { authorization: `Bearer ${session.accessToken}` },
     * });
     * if (step.next === 'consent') step.access.candidate; // 'account'
     */
    get(search: string, options?: Omit<FetchOptions, 'query'>) {
      const query =
        search === '' || search.startsWith('?') ? search : `?${search}`;
      return client.fetch<McpConsentStep>(`/mcp/consent${query}`, options);
    },

    /**
     * Allow or Cancel on the step `get` showed, as the signed-in visitor.
     * Every check runs again; a `redirect` sends the browser to the
     * assistant's own callback.
     *
     * @example
     * const decision = await board.mcpConsent.submit(
     *   { request: step.request, consentToken: step.consentToken, decision: 'allow' },
     *   { headers: { authorization: `Bearer ${session.accessToken}` } },
     * );
     */
    submit(body: McpConsentDecisionBody, options?: FetchOptions) {
      return client.fetch<McpConsentDecision>('/mcp/consent', {
        ...options,
        method: 'POST',
        body,
      });
    },
  };
}
