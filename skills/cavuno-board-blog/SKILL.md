---
name: cavuno-board-blog
description: Build the blog with the @cavuno/board SDK — post archives (blog.posts.list with tagSlug/authorSlug/featured), the post page (blog.posts.retrieve + adjacent + similar), blog.tags and blog.authors, and free-text blog.search. Covers the summary-vs-detail split (html on the single read only), cursor pagination, slug-change redirects (redirected/newSlug), and the SEO fields the API actually returns.
---

# Blog: posts, tags, authors, search

Every list and search returns `PublicBlogPostSummary`; only `posts.retrieve` returns the full `PublicBlogPost` with the `html` body.

## When to use

- The blog index, tag archives, author archives, and featured rails.
- The post page: body, prev/next nav, related-posts rail.
- Blog search boxes.

## When not to use

- Writing posts/tags/authors — that is the admin API; this SDK is the public read surface.
- Deciding whether the board has a blog at all — read `features.blog` from the board context.

Out of scope — do not invent exports: no RSS feed, sitemap, or OG-image generation — the host app builds those routes from the data here (`publishedAt`, `canonicalUrl`, `ogImageUrl` are all returned).

## List posts and archives

`blog.posts.list` returns a `ListEnvelope<PublicBlogPostSummary>`. `BlogPostsListQuery` supports `limit` (1–100), `cursor`, `tagSlug`, `authorSlug`, and `featured: 'true'` (opt-in only — the string literal, not a boolean). Blog lists page by cursor only; there is no `offset` and no total `count`.

```ts snippet
const page = await board.blog.posts.list({ tagSlug: 'news', limit: 12 });
for (const post of page.data) {
  post.title;
  post.customExcerpt;   // null unless the author wrote one
  post.coverUrl;        // null when no cover image
  post.readingTimeMin;
  post.authors;         // embedded: id, name, slug, bio, avatarUrl, social URLs
  post.tags;            // embedded: id, name, slug, description
}
const next = page.nextCursor
  ? await board.blog.posts.list({ tagSlug: 'news', limit: 12, cursor: page.nextCursor })
  : null; // nextCursor is null when hasMore is false
```

## Render a post

`posts.retrieve` adds the detail-only fields: `html` (the rendered rich-text body, nullable), `ogImageUrl`, `featureImageCaption`, `seoTitle`, `seoDescription`, `redirected`, `newSlug`.

```ts snippet
const post = await board.blog.posts.retrieve('hello-world');
if (post.redirected && post.newSlug) {
  // the slug changed — redirect to the post at newSlug instead of rendering here
}
post.html;                          // inject as the article body
post.seoTitle ?? post.title;        // <title>
post.seoDescription ?? post.customExcerpt; // meta description
post.canonicalUrl;                  // author-set canonical override, or null
post.ogImageUrl ?? post.coverUrl;   // social card image
```

Anti-pattern: don't render a post at a stale URL. When `redirected` is true, issue a redirect to `newSlug` — old slugs keep resolving, but the canonical location moved.

Anti-pattern: don't look for `html` on list items. Summaries never carry it; fetch `retrieve` for the post page only.

## Prev/next and related

```ts snippet
const { previous, next } = await board.blog.posts.adjacent('hello-world');
// previous = older post, next = newer; each a summary or null

const rail = await board.blog.posts.similar('hello-world', { limit: 6 }); // 1–20, default 6
```

## Tags and authors

Both are list + retrieve-by-slug. `PublicBlogTag`: `id`, `name`, `slug`, `description`. `PublicBlogAuthor`: `id`, `name`, `slug`, `bio`, `avatarUrl`, `websiteUrl`, `twitterUrl`, `linkedinUrl`, `githubUrl`.

```ts snippet
const { data: tags } = await board.blog.tags.list();
const tag = await board.blog.tags.retrieve('news');
const { data: authors } = await board.blog.authors.list();
const author = await board.blog.authors.retrieve('jane');
```

Archive pages combine the two: `tags.retrieve` for the header, `posts.list({ tagSlug })` for the posts.

## Search

`blog.search` posts a `BlogSearchBody` (`query` up to 200 chars, optional `cursor`, `limit` 1–50 — note the lower cap than lists) and returns a `SearchEnvelope<PublicBlogPostSummary>`:

```ts snippet
const results = await board.blog.search({ query: 'launch', limit: 10 });
results.data[0]?.slug;
```

## Verify

- A list item has no `html` key; `posts.retrieve` of the same slug returns it (string or null).
- Retrieving a post by an old slug returns `redirected: true` with `newSlug` set, and your route redirects there.
- `posts.list({ featured: 'true' })` returns only posts with `featured: true`.
- Cursor paging terminates: `nextCursor` is `null` on the last page.
- `adjacent` on the newest post returns `next: null`; on the oldest, `previous: null`.
