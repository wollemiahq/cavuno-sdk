# Blog structured data

Read this reference for blog-post `Article` and author `ProfilePage` JSON-LD.

```ts snippet
import {
  createAuthorProfileJsonLd,
  createBlogArticleJsonLd,
} from '@cavuno/board/seo';

const { name } = await board.context();
const post = await board.blog.posts.retrieve('hello-world');
const article = createBlogArticleJsonLd({
  post,
  boardName: name,
  permalink: `https://jobs.example.com/blog/${post.slug}`,
  ogImageUrl: `https://jobs.example.com/blog/${post.slug}/og`,
});

const author = await board.blog.authors.retrieve('jane');
const { data: authorPosts } = await board.blog.posts.list({
  authorSlug: 'jane',
});
// Profile description is application-owned. Prefer author.bio; otherwise
// compose from the board catalog (shape only — not an English sentence).
const profile = createAuthorProfileJsonLd({
  author,
  canonical: `https://jobs.example.com/blog/author/${author.slug}`,
  description:
    author.bio ?? messages.authorProfileDescription({ name: author.name }),
  origin: 'https://jobs.example.com',
  posts: authorPosts,
  totalPosts: authorPosts.length,
});
```

The article `ogImageUrl` is the fallback when the post has no cover. Supply
author posts newest-first; the profile builder keeps the first five as
`hasPart`.

This branch is complete when the post emits an `Article`, the author emits a
`ProfilePage`, every URL is absolute and canonical, and a null builder result
leaves no script tag.
