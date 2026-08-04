# Job detail and breadcrumbs

Read this reference for Google for Jobs `JobPosting` or `BreadcrumbList`
structured data.

## Build JobPosting JSON-LD

`PublicJob` carries the inputs, including derived remote permit codes.
Worldwide-remote jobs automatically enumerate all 249 countries because
Google requires a location signal alongside `TELECOMMUTE`.

```ts snippet
import { createJobPostingJsonLd } from '@cavuno/board/seo';

const { name, logoUrl } = await board.context();
const job = await board.jobs.retrieve('senior-chef');

const jsonLd = createJobPostingJsonLd({
  job,
  board: { name, logoUrl },
  shareUrl:
    `https://jobs.example.com/companies/${job.company?.slug}/jobs/${job.slug}`,
});
```

Use the builder as the schema boundary. It encodes pruning, salary mirroring,
remote-location behavior, and Google for Jobs shapes.

## Build BreadcrumbList JSON-LD

Labels are trimmed, blank crumbs are dropped, and fewer than two surviving
crumbs return `null`. The current page omits `href`, which makes the builder
omit its `item`. Supply absolute hrefs, or pass `origin` for path hrefs.

Breadcrumb labels are application-owned — pull them from the board's message
catalog. The snippet shows structure only, not English copy.

```ts snippet
import { createBreadcrumbJsonLd } from '@cavuno/board/seo';

const trail = createBreadcrumbJsonLd(
  [
    { label: messages.breadcrumb('home'), href: '/' },
    { label: messages.breadcrumb('jobs'), href: '/jobs' },
    { label: job.title },
  ],
  { origin: 'https://jobs.example.com' });
```

This branch is complete when the JobPosting passes Google's Rich Results test,
the worldwide-remote fixture contains 249 countries, and breadcrumb output is
absent below two usable crumbs.
