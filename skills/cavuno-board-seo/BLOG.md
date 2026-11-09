# Blog structured data

Read this reference for blog-post `Article` and author `ProfilePage` JSON-LD.

```ts snippet
import {
  createAuthorProfileJsonLd,
  createBlogArticleJsonLd,
} from '@cavuno/board/seo';

const { name } = await board.context();
const post = await board.blog.posts.retrieve('hello-world');
const [firstAuthor] = post.authors;
const article = createBlogArticleJsonLd({
  post,
  boardName: name,
  permalink: `https://jobs.example.com/blog/${post.slug}`,
  ogImageUrl: `https://jobs.example.com/blog/${post.slug}/og`,
  authorProfileUrl: firstAuthor
    ? `https://jobs.example.com/blog/author/${firstAuthor.slug}`
    : null,
});

const author = await board.blog.authors.retrieve('jane');
const authorPosts = await board.blog.posts.list({ authorSlug: 'jane' });
// Profile description is application-owned. Prefer author.bio; otherwise
// compose from the board catalog (shape only — not an English sentence).
const profile = createAuthorProfileJsonLd({
  author,
  canonical: `https://jobs.example.com/blog/author/${author.slug}`,
  description:
    author.bio ?? messages.authorProfileDescription({ name: author.name }),
  origin: 'https://jobs.example.com',
  posts: authorPosts.data,
  // The author's total, not this page's length.
  totalPosts: authorPosts.count ?? authorPosts.data.length,
});
```

The article `ogImageUrl` is the fallback when the post has no cover. Pass
`authorProfileUrl` as the same URL you give the profile's `canonical`, so the
post's author and the profile's `Person` share one `@id`. Supply author posts
newest-first; the profile builder keeps the first five as `hasPart`. The list's
`count` is the author's total published posts; `data` is one page.

This branch is complete when the post emits an `Article`, the author emits a
`ProfilePage`, every URL is absolute and canonical, and a null builder result
leaves no script tag.
