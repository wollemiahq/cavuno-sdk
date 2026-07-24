// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response shapes + the search body alias the
// generated components; the list/similar query types stay hand-written.
import type { Schemas } from './_spec';

/** Author shape embedded on posts (no `object` discriminator). */
export type BlogAuthorEmbed = Schemas['PublicBlogAuthorEmbed'];

/** Tag shape embedded on posts (no `object` discriminator). */
export type BlogTagEmbed = Schemas['PublicBlogTagEmbed'];

export type PublicBlogAuthor = Schemas['PublicBlogAuthor'];
export type PublicBlogTag = Schemas['PublicBlogTag'];
export type PublicBlogPostSummary = Schemas['PublicBlogPostSummary'];

/** Detail shape — `html` appears on the single read only, never on summaries. */
export type PublicBlogPost = Schemas['PublicBlogPost'];

/** Previous (older) + next (newer) posts for the detail prev/next nav. */
export type PublicBlogAdjacentPosts = Schemas['PublicBlogAdjacentPosts'];

export type BlogPostsListQuery = {
  cursor?: string;
  /** 1–100. */
  limit?: number;
  tagSlug?: string;
  authorSlug?: string;
  /** Opt-in only: pass `'true'` to restrict to featured posts. */
  featured?: 'true';
};

export type BlogSimilarQuery = {
  /** 1–20; default 6. */
  limit?: number;
};

export type BlogSearchBody = Schemas['PublicBlogSearchBody'];
