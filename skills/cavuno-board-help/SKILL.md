---
name: cavuno-board-help
description: Public help center reads with @cavuno/board. Use for a help home, help category pages, help article pages, article structured data, or the help link in navigation.
---

# Help center

`board.help` returns what the operator has published: categories, article
summaries, and one article with its `html` body. Lists arrive in the
operator's order and are cursor-paginated: 25 a page by default, up to 100
with `limit`. Read
`board.context().features.helpCenter` to decide whether to link the help
center; it is `true` when the board has a published article. The operator
writes articles in the dashboard; your site only reads them.

## Routes

Publish three pages, one per route role, so platform links and the sitemap
resolve to your URLs:

| Role | Default path | Route parameter |
| --- | --- | --- |
| `help` | `/help` | none |
| `helpCategory` | `/help/categories/<slug>` | `helpCategorySlug` |
| `helpArticle` | `/help/articles/<slug>` | `helpArticleSlug` |

Keep the parameter names when you rename or translate a path; the roles are
recognised by them.

```ts snippet
import {
  BOARD_PATHS,
  helpArticlePath,
  helpCategoryPath,
} from '@cavuno/board/paths';

BOARD_PATHS.help;
helpCategoryPath('getting-started');
helpArticlePath('how-to-apply');
```

## Build the help home

Read one page of each list and group articles by `category.id`. Do not sort:
the order is the operator's.

```ts snippet
const [categories, articles] = await Promise.all([
  board.help.categories.list({ limit: 100 }),
  board.help.articles.list({ limit: 100 }),
]);
for (const category of categories.data) {
  category.title;
  category.description;
  articles.data.filter((article) => article.category.id === category.id);
}
articles.hasMore;
```

`PublicHelpCategory` carries `id`, `slug`, `title`, and `description`.
`PublicHelpArticleSummary` carries `id`, `slug`, `title`, `summary`,
`category` (`id`, `slug`, `title`), `publishedAt`, and `updatedAt`. Only
categories with a published article are returned. Two empty lists mean
nothing is published: render the 404.

A page is not the whole help center. When `hasMore` is `true`, link each
category to its own page for the rest, or walk every page with `paginate`:

```ts snippet
import { paginate } from '@cavuno/board';

for await (const article of paginate(board.help.articles.list, {
  limit: 100,
})) {
  article.slug;
}
```

## Build a category page

```ts snippet
const category = await board.help.categories.retrieve('getting-started');
const page = await board.help.articles.list({
  categorySlug: category.slug,
});
page.data;
if (page.hasMore && page.nextCursor) {
  await board.help.articles.list({
    categorySlug: category.slug,
    cursor: page.nextCursor,
  });
}
```

Pass `nextCursor` back with the same `categorySlug`; a cursor from another
list is `pagination_invalid_cursor` (400). An unknown slug throws
`help_category_not_found` (404).

## Render an article and canonicalize its slug

`articles.retrieve` adds `html`, `redirected`, and `newSlug`. Old slugs still
resolve: when `redirected` and `newSlug` are set, redirect permanently to
`newSlug` before rendering.

```ts snippet
const article = await board.help.articles.retrieve('how-to-apply');
if (article.redirected && article.newSlug) {
  // Redirect to the article route at article.newSlug.
}
article.html;
article.title;
article.summary;
article.category.title;
article.updatedAt;
```

Render `html` on the server so the title and body are in the page HTML. Use
`title` as the page title and `summary` as the meta description. An unknown
slug throws `help_article_not_found` (404).

## Add structured data

```ts snippet
import {
  BOARD_PATHS,
  helpArticlePath,
  helpCategoryPath,
} from '@cavuno/board/paths';
import {
  createBreadcrumbJsonLd,
  createHelpArticleJsonLd,
} from '@cavuno/board/seo';

const article = await board.help.articles.retrieve('how-to-apply');
const origin = 'https://jobs.example.com';
const articleJsonLd = createHelpArticleJsonLd({
  article,
  boardName: 'Example Jobs',
  permalink: `${origin}${helpArticlePath(article.slug)}`,
});
const breadcrumbJsonLd = createBreadcrumbJsonLd(
  [
    { label: 'Help', href: BOARD_PATHS.help },
    {
      label: article.category.title,
      href: helpCategoryPath(article.category.slug),
    },
    { label: article.title, href: helpArticlePath(article.slug) },
  ],
  { origin });
```

Build the URLs with your own route helpers when the board renames or
translates the help paths.

## Completion gate

Finish only after every applicable check passes:

- The help link in the header or footer renders only when
  `features.helpCenter` is `true`.
- The help home groups articles under their categories without re-sorting.
- A list with `hasMore` set leads to the rest: a link to the category page,
  a next page, or a `paginate` walk.
- The article page has the title and body in the server HTML, a canonical URL,
  and `Article` plus `BreadcrumbList` JSON-LD.
- A retrieved old slug redirects to `newSlug` before rendering.
- Unknown category and article slugs render the 404.
- The three routes keep the `helpCategorySlug` and `helpArticleSlug` parameter
  names.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
