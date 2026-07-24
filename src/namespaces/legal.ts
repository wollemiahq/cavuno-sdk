import type { BoardClient, FetchOptions } from '../client';
import type { LegalPageType, PublicLegalPage } from '../types/legal';

export function legalNamespace(client: BoardClient) {
  return {
    /**
     * Retrieve a board legal/about page — owner-authored prose as portable HTML
     * (`privacy-policy` / `terms-of-service` / `cookie-policy` / `about`) plus,
     * for `impressum`, structured legal-entity facts. The starter authors the
     * layout, breadcrumb labels, and JSON-LD. `impressum` throws
     * `board_page_not_found` (404) when the board has not enabled it.
     *
     * @example
     * const { title, content } = await board.legal.retrieve('privacy-policy');
     */
    retrieve(type: LegalPageType, options?: FetchOptions) {
      return client.fetch<PublicLegalPage>(
        `/legal/${encodeURIComponent(type)}`,
        options,
      );
    },
  };
}
