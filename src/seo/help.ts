/**
 * Help center structured data on the `@cavuno/board` wire types.
 *
 * JSON-LD structure is locale-neutral — no board-language parameter; every
 * display string is a wire value passed through. For the trail above an
 * article, pass your own labels to `createBreadcrumbJsonLd`.
 */
import type { PublicHelpArticleSummary } from '../types/help';
import type { JsonLdObject } from './job-posting';

/**
 * The article fields the builder reads — the detail `PublicHelpArticle`
 * satisfies this.
 */
export type HelpArticleJsonLdArticle = Pick<
  PublicHelpArticleSummary,
  'title' | 'summary' | 'publishedAt' | 'updatedAt'
>;

/**
 * `Article` for a help article, published by the board. `dateModified` is
 * the article's `updatedAt`: when the published text last changed.
 */
export function createHelpArticleJsonLd({
  article,
  boardName,
  permalink,
}: {
  article: HelpArticleJsonLdArticle;
  boardName: string;
  /** Absolute canonical URL of the article page. */
  permalink: string;
}): JsonLdObject {
  const jsonLd: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    url: permalink,
    mainEntityOfPage: { '@type': 'WebPage', '@id': permalink },
    publisher: { '@type': 'Organization', name: boardName },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
  };
  if (article.summary) jsonLd.description = article.summary;
  return jsonLd;
}
