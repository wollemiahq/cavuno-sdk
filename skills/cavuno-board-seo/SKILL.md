---
name: cavuno-board-seo
description: SEO builders with @cavuno/board/seo. Use for JobPosting or breadcrumb JSON-LD, blog schema, salary rich results, or job-listing head metadata.
---

# SEO builders

`@cavuno/board/seo` returns the hosted board's structured data and
framework-neutral listing-head descriptors.

## Select the page branch

Read the matching reference completely before implementing that page:

- Job detail or breadcrumbs: [`JOB_AND_BREADCRUMBS.md`](JOB_AND_BREADCRUMBS.md)
- Blog post or author profile: [`BLOG.md`](BLOG.md)
- Salary detail, index, comparison, or FAQ: [`SALARY.md`](SALARY.md)
- Job-listing metadata or structural JSON-LD: [`LISTING.md`](LISTING.md)

For a page that combines branches, read every matching reference.

Sitemaps and robots.txt use `cavuno-board-sitemap`. The host app owns OG-image
generation and its route map. `listingHead` receives app-owned title and
meta description copy; the SDK never composes those sentences or joins
count/heading/board name.

## Apply the shared rendering contract

Builders with nullable return types use `null` when no useful object remains.
Emit a `<script type="application/ld+json">` only for a non-null result.
Helpers that produce display strings take `board.context().language` as their
required leading argument; pass the context value as the locale.

## Completion gate

Finish only after every applicable branch check passes:

- Each emitted JSON-LD value is non-null and is serialized in an
  `application/ld+json` script.
- Job detail validates as `JobPosting` in Google's Rich Results test; a
  worldwide-remote job contains all 249 country codes.
- Breadcrumb schema appears only with at least two non-blank crumbs.
- Blog post and author pages emit their matching `Article` and `ProfilePage`
  objects with canonical absolute URLs.
- Salary builders receive the board language wherever their signature
  requires it, and rendered figures match the returned salary read model.
- Listing head output supplies title, description, Open Graph descriptors,
  and canonical link for the requested absolute origin and path.

## Cavuno SDK reference

For setup and API details beyond this workflow, use the [Cavuno Board SDK documentation](https://cavuno.com/docs/sdk).
