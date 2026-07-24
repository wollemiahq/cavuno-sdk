/**
 * Blog structured data on the `@cavuno/board` wire types, transcribed from
 * the hosted board's builders (the hosted board implementation:
 * `createArticleJsonLd` + `createAuthorProfilePageJsonLd`) and tested
 * against them .
 *
 * JSON-LD structure is locale-neutral — no board-language parameter; every
 * display string is a wire value (or caller copy) passed through.
 */
import type { BlogAuthorEmbed, PublicBlogPostSummary } from '../types/blog';
import type { JsonLdObject } from './job-posting';

/**
 * The post fields the Article builder reads — the detail `PublicBlogPost`
 * satisfies this.
 */
export type ArticleJsonLdPost = Pick<
  PublicBlogPostSummary,
  'title' | 'customExcerpt' | 'publishedAt' | 'coverUrl' | 'authors'
>;

/**
 * `Article` (+ author/publisher) for a blog post — mirrors the hosted
 * Article JSON-LD.
 *
 * `image` follows the hosted precedence: the post's cover (feature) image
 * first, then `ogImageUrl` — pass your page's OG image URL (hosted passes
 * its generated `/blog/:slug/og` card; OG generation itself is app-owned
 * per ).
 */
export function createBlogArticleJsonLd({
  post,
  boardName,
  permalink,
  ogImageUrl,
}: {
  post: ArticleJsonLdPost;
  boardName: string;
  permalink: string;
  /** Fallback image when the post has no cover, e.g. your generated OG card URL. */
  ogImageUrl?: string | null;
}): JsonLdObject {
  const article: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    url: permalink,
    mainEntityOfPage: { '@type': 'WebPage', '@id': permalink },
    publisher: { '@type': 'Organization', name: boardName },
  };
  if (post.customExcerpt) article.description = post.customExcerpt;
  if (post.publishedAt) article.datePublished = post.publishedAt;
  const image = post.coverUrl ?? ogImageUrl;
  if (image) article.image = image;

  const author = post.authors[0];
  if (author) {
    article.author = {
      '@type': 'Person',
      name: author.name,
      ...(author.websiteUrl ? { url: author.websiteUrl } : {}),
    };
  }
  return article;
}

/**
 * `ProfilePage` for a blog author page — the hosted shape: a `Person` main
 * entity (id-anchored at `#profile`, social links normalized into `sameAs`),
 * the author's recent posts as `hasPart` Articles, and a WriteAction
 * `InteractionCounter` for the post count.
 *
 * Returns `null` when the author has no name. `hasPart` URLs assume the
 * `/blog/:slug` post route (the hosted and starter convention).
 */
export function createAuthorProfileJsonLd({
  author,
  canonical,
  description,
  origin,
  posts,
  totalPosts,
}: {
  author: BlogAuthorEmbed;
  /** Absolute canonical URL of the author page. */
  canonical: string;
  /** Author blurb — hosted passes the bio (or its templated hero copy). */
  description: string;
  /** Site origin for `hasPart` post URLs; `null` omits the posts. */
  origin: string | null;
  /** The author's recent posts (newest first) — the builder keeps the first 5. */
  posts: Pick<PublicBlogPostSummary, 'title' | 'slug' | 'publishedAt'>[];
  totalPosts: number;
}): JsonLdObject | null {
  if (!author.name) {
    return null;
  }

  const normalizedDescription = description.trim();
  const sameAs = [
    normalizeUrl(author.websiteUrl),
    normalizeUrl(author.twitterUrl),
    normalizeUrl(author.linkedinUrl),
    normalizeUrl(author.githubUrl),
  ].filter((value): value is string => Boolean(value));
  const authorId = `${canonical}#profile`;
  const hasPart = posts
    .slice(0, 5)
    .map((post): JsonLdObject | null => {
      const postUrl = buildAbsoluteUrl(origin, `/blog/${post.slug}`);

      if (!postUrl) {
        return null;
      }

      return {
        '@type': 'Article',
        headline: post.title,
        url: postUrl,
        datePublished: post.publishedAt,
        author: { '@id': authorId },
      };
    })
    .filter((value): value is JsonLdObject => value !== null);

  const agentInteractionStatistic =
    totalPosts > 0
      ? {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/WriteAction',
          userInteractionCount: totalPosts,
        }
      : undefined;

  const profilePage: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: canonical,
    mainEntity: {
      '@type': 'Person',
      '@id': authorId,
      name: author.name,
      alternateName: author.slug ?? undefined,
      identifier: author.id ?? undefined,
      description: normalizedDescription || undefined,
      image: author.avatarUrl ?? undefined,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      url: canonical,
      mainEntityOfPage: canonical,
      agentInteractionStatistic,
    },
  };

  if (hasPart.length > 0) {
    profilePage.hasPart = hasPart;
  }

  return profilePage;
}

/** Trim + `https://`-prefix + `URL`-normalize; `null` for blank/invalid input. */
// Sibling of job-posting.ts normalizeWebsiteUrl — the URL() round-trip here
// (which canonicalizes a trailing slash) is an INTENTIONAL divergence: hosted
// author sameAs normalizes differently from hosted company sameAs.
function normalizeUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const candidate =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;

    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function buildAbsoluteUrl(
  origin: string | null,
  path: string | null | undefined,
): string | null {
  if (!origin || !path) {
    return null;
  }

  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}
