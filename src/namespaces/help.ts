import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  HelpArticlesListQuery,
  HelpCategoriesListQuery,
  HelpSearchQuery,
  HelpSimilarQuery,
  PublicHelpArticle,
  PublicHelpArticleSummary,
  PublicHelpCategory,
} from '../types/help';

export function helpNamespace(client: BoardClient) {
  return {
    categories: {
      /**
       * The help center categories that hold a published article, in the
       * order the board set. Cursor-paginated: 25 a page by default, up to
       * 100. Follow `nextCursor`, or use `paginate`, for the rest.
       *
       * @example
       * const { data, hasMore } = await board.help.categories.list();
       * const all = await paginate(board.help.categories.list, { limit: 100 })
       *   .toArray({ limit: 500 });
       */
      list(query?: HelpCategoriesListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicHelpCategory>>(
          '/help/categories',
          { ...options, query },
        );
      },

      /**
       * One category by slug. A `help_category_not_found` error (404) means
       * no category with a published article has the slug.
       *
       * @example
       * const category = await board.help.categories.retrieve('getting-started');
       */
      retrieve(
        categorySlug: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<PublicHelpCategory>(
          `/help/categories/${encodeURIComponent(categorySlug)}`,
          { ...options, query },
        );
      },
    },

    articles: {
      /**
       * Published articles (summaries — no `html`), by category order and
       * then article order, as the board set them. Cursor-paginated: 25 a
       * page by default, up to 100. Follow `nextCursor`, or use `paginate`,
       * for the rest; a cursor belongs to the `categorySlug` it was
       * returned for.
       *
       * @example
       * const { data, hasMore } = await board.help.articles.list({
       *   categorySlug: 'getting-started',
       * });
       * for await (const article of paginate(board.help.articles.list, {
       *   limit: 100,
       * })) {
       *   article.title;
       * }
       */
      list(query?: HelpArticlesListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicHelpArticleSummary>>(
          '/help/articles',
          { ...options, query },
        );
      },

      /**
       * One published article by slug, including its `html` body. When the
       * slug is one the article used to have, `redirected` is `true` and
       * `newSlug` is the current slug: redirect there.
       *
       * @example
       * const article = await board.help.articles.retrieve('how-to-apply');
       */
      retrieve(
        articleSlug: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<PublicHelpArticle>(
          `/help/articles/${encodeURIComponent(articleSlug)}`,
          { ...options, query },
        );
      },

      /**
       * Published articles nearest in meaning to one article, from every
       * category and without the article itself: nearest first, with
       * articles of the same category ranked a little higher. Up to 6 by
       * default, 20 at most. The list is empty until the article is in
       * the search index, a few minutes after it is published; a
       * `search_unavailable` error (503) means the index cannot answer.
       * Show the category's other articles in both cases.
       *
       * @example
       * const { data } = await board.help.articles.similar('how-to-apply', {
       *   limit: 4,
       * });
       */
      similar(
        articleSlug: string,
        query?: HelpSimilarQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<ListEnvelope<PublicHelpArticleSummary>>(
          `/help/articles/${encodeURIComponent(articleSlug)}/similar`,
          { ...options, query },
        );
      },
    },

    /**
     * Published articles that match `q` by title, summary or body, best
     * match first (summaries: no `html`). One page of up to 10 by default,
     * 50 at most; there is no cursor. An article is searchable a few
     * minutes after it is published. A `search_unavailable` error (503)
     * means the index cannot answer: fall back to matching the article
     * list yourself.
     *
     * @example
     * const { data } = await board.help.search({ q: 'reset my password' });
     */
    search(query: HelpSearchQuery, options?: FetchOptions) {
      return client.fetch<ListEnvelope<PublicHelpArticleSummary>>(
        '/help/search',
        { ...options, query },
      );
    },
  };
}
