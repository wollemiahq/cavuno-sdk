# Listing metadata and JSON-LD

Read this reference for a job-listing page's head descriptors and structural
JSON-LD. These builders are locale-neutral pass-throughs; supply the page's
resolved heading copy.

```ts snippet
import { listingHead, listingJsonLd } from '@cavuno/board/seo';

const { name } = await board.context();
const head = listingHead({
  boardName: name,
  origin: 'https://jobs.example.com',
  path: '/jobs/robotics',
  heading: 'Robotics jobs',
  count: 42,
});

const objects = listingJsonLd({
  origin: 'https://jobs.example.com',
  breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Jobs' }],
  jobs: cards.map((card) => ({
    slug: card.slug,
    company: card.company,
  })),
});
```

`head.meta` contains title, description, and Open Graph descriptors;
`head.links` contains the canonical link. For the example, the count-aware
title is `42 Robotics jobs | Acme Jobs`.

This branch is complete when head descriptors reflect the resolved page
heading and count, the canonical URL combines the intended origin and path,
and `listingJsonLd` receives card slugs plus company objects from the listing
response.
