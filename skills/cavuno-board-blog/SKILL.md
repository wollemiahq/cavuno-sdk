---
name: cavuno-board-blog
description: Public blog reads with @cavuno/board. Use for post archives, post detail, adjacent or similar posts, tag and author pages, or blog search.
---

# Blog

Collections return `PublicBlogPostSummary`; only `blog.posts.retrieve`
returns `PublicBlogPost` with the rendered `html` body. Read
`board.context().features.blog` when deciding whether the board exposes a blog.
The host app owns authoring, feeds, sitemaps, and OG-image routes.

## Build archives

`blog.posts.list` returns `ListEnvelope<PublicBlogPostSummary>`. Its query
accepts `limit` (1–100), `cursor`, `tagSlug`, `authorSlug`, and
`featured: 'true'`. `featured` is the string literal. Blog lists use cursor
pagination and expose neither `offset` nor total `count`.

```ts snippet
const page = await board.blog.posts.list({ tagSlug: 'news', limit: 12 });
for (const post of page.data) {
  post.title;
  post.customExcerpt;
  post.coverUrl;
  post.readingTimeMin;
  post.authors;
  post.tags;
}
const next = page.nextCursor
  ? await board.blog.posts.list({
      tagSlug: 'news',
      limit: 12,
      cursor: page.nextCursor,
    })
  : null;
```

Embedded author rows carry `id`, `name`, `slug`, `bio`, `location`,
`avatarUrl`, and social URLs (`websiteUrl`, `facebookUrl`, `twitterUrl`,
`linkedinUrl`, `githubUrl`). Embedded tag rows carry `id`, `name`, `slug`, and
`description`.

## Render a post and canonicalize its slug

`posts.retrieve` adds `html`, `ogImageUrl`, `featureImageCaption`, `seoTitle`,
`seoDescription`, `redirected`, and `newSlug`. Old slugs still resolve: when
`redirected` and `newSlug` are set, redirect to `newSlug` before rendering.

```ts snippet
const post = await board.blog.posts.retrieve('hello-world');
if (post.redirected && post.newSlug) {
  // Redirect to the post route at post.newSlug.
}
post.html;
post.seoTitle ?? post.title;
post.seoDescription ?? post.customExcerpt;
post.canonicalUrl;
post.ogImageUrl ?? post.coverUrl;
```

Fetch detail for the post page; summaries have no `html` field.

## Add post navigation

```ts snippet
const { previous, next } = await board.blog.posts.adjacent('hello-world');
// previous is older; next is newer; either can be null.

const rail = await board.blog.posts.similar('hello-world', { limit: 6 });
```

`similar` accepts `limit` 1–20 and defaults to 6.

## Build tag and author pages

Tags and authors each provide list plus retrieve-by-slug. Combine a retrieved
entity with `posts.list({ tagSlug })` or `posts.list({ authorSlug })` for its
archive.

```ts snippet
const { data: tags } = await board.blog.tags.list();
const tag = await board.blog.tags.retrieve('news');
const { data: authors } = await board.blog.authors.list();
const author = await board.blog.authors.retrieve('jane');
```

`PublicBlogTag` carries `id`, `name`, `slug`, and `description`.
`PublicBlogAuthor` carries `id`, `name`, `slug`, `bio`, `location`,
`avatarUrl`, `websiteUrl`, `facebookUrl`, `twitterUrl`, `linkedinUrl`, and
`githubUrl`.

## Search posts

`blog.search` posts `BlogSearchBody`: `query` up to 200 characters, optional
`cursor`, and `limit` 1–50. It returns
`SearchEnvelope<PublicBlogPostSummary>`.

```ts snippet
const results = await board.blog.search({ query: 'launch', limit: 10 });
results.data[0]?.slug;
```

## Completion gate

Finish only after every applicable check passes:

- Archive and search rows render summaries; the post page fetches detail for
  `html`.
- A retrieved old slug redirects to `newSlug` before rendering.
- Featured archives send the exact string `featured: 'true'`.
- Cursor paging reaches `nextCursor: null` without relying on count or offset.
- Newest and oldest posts handle the null side of `adjacent`.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
