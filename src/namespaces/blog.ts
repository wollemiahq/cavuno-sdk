import type { BoardClient, FetchOptions } from '../client';
import type {
  BlogPostsListQuery,
  BlogSearchBody,
  BlogSimilarQuery,
  PublicBlogAdjacentPosts,
  PublicBlogAuthor,
  PublicBlogPost,
  PublicBlogPostSummary,
  PublicBlogTag,
} from '../types/blog';
import type { ListEnvelope, SearchEnvelope } from '../types/common';

export function blogNamespace(client: BoardClient) {
  return {
    posts: {
      /**
       * List published posts (summaries — no `html`).
       *
       * @example
       * const { data } = await board.blog.posts.list({ tagSlug: 'news' });
       */
      list(query?: BlogPostsListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicBlogPostSummary>>(
          '/blog/posts',
          { ...options, query },
        );
      },

      /**
       * Retrieve one post by slug, including its `html` body.
       *
       * @example
       * const post = await board.blog.posts.retrieve('hello-world');
       */
      retrieve(
        postSlug: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<PublicBlogPost>(
          `/blog/posts/${encodeURIComponent(postSlug)}`,
          { ...options, query },
        );
      },

      /**
       * The previous (older) and next (newer) posts for prev/next navigation.
       *
       * @example
       * const { previous, next } = await board.blog.posts.adjacent('hello-world');
       */
      adjacent(postSlug: string, options?: FetchOptions) {
        return client.fetch<PublicBlogAdjacentPosts>(
          `/blog/posts/${encodeURIComponent(postSlug)}/adjacent`,
          options,
        );
      },

      /**
       * Posts most similar to one post (the related-posts rail).
       *
       * @example
       * const { data } = await board.blog.posts.similar('hello-world', { limit: 6 });
       */
      similar(
        postSlug: string,
        query?: BlogSimilarQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<ListEnvelope<PublicBlogPostSummary>>(
          `/blog/posts/${encodeURIComponent(postSlug)}/similar`,
          { ...options, query },
        );
      },
    },

    tags: {
      /** @example const { data } = await board.blog.tags.list(); */
      list(query?: Record<string, never>, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicBlogTag>>('/blog/tags', {
          ...options,
          query,
        });
      },

      /** @example const tag = await board.blog.tags.retrieve('news'); */
      retrieve(
        tagSlug: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<PublicBlogTag>(
          `/blog/tags/${encodeURIComponent(tagSlug)}`,
          { ...options, query },
        );
      },
    },

    authors: {
      /** @example const { data } = await board.blog.authors.list(); */
      list(query?: Record<string, never>, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicBlogAuthor>>('/blog/authors', {
          ...options,
          query,
        });
      },

      /** @example const author = await board.blog.authors.retrieve('jane'); */
      retrieve(
        authorSlug: string,
        query?: Record<string, never>,
        options?: FetchOptions,
      ) {
        return client.fetch<PublicBlogAuthor>(
          `/blog/authors/${encodeURIComponent(authorSlug)}`,
          { ...options, query },
        );
      },
    },

    /**
     * Free-text post search (returns post summaries).
     *
     * @example
     * const { data } = await board.blog.search({ query: 'launch' });
     */
    search(
      body: BlogSearchBody,
      query?: Record<string, never>,
      options?: FetchOptions,
    ) {
      return client.fetch<SearchEnvelope<PublicBlogPostSummary>>(
        '/blog/search',
        { ...options, method: 'POST', body, query },
      );
    },
  };
}
