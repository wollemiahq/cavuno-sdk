// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response shapes alias the generated components; the
// list query types stay hand-written.
import type { Schemas } from './_spec';

/** A help center category that holds at least one published article. */
export type PublicHelpCategory = Schemas['PublicHelpCategory'];

/** The category as an article carries it (no `object` discriminator). */
export type HelpCategoryEmbed = Schemas['PublicHelpCategoryEmbed'];

/** A published help article without its body. */
export type PublicHelpArticleSummary = Schemas['PublicHelpArticleSummary'];

/** Detail shape — `html` appears on the single read only, never on summaries. */
export type PublicHelpArticle = Schemas['PublicHelpArticle'];

export type HelpCategoriesListQuery = {
  /** Opaque cursor from a previous response's `nextCursor`. */
  cursor?: string;
  /** Page size, 1-100. Defaults to 25. */
  limit?: number;
};

export type HelpArticlesListQuery = HelpCategoriesListQuery & {
  /** Keep one category's articles, by its slug. */
  categorySlug?: string;
};

export type HelpSearchQuery = {
  /** What the visitor typed. 1-200 characters. */
  q: string;
  /** The most articles to return, 1-50. Defaults to 10. */
  limit?: number;
};

export type HelpSimilarQuery = {
  /** The most related articles to return, 1-20. Defaults to 6. */
  limit?: number;
};
