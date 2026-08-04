# Listing metadata and JSON-LD

Read this reference for a job-listing page's head descriptors and structural
JSON-LD. These builders assemble structure only; supply the page's resolved
title and meta description from the board's copy source.

```ts snippet
import { listingHead, listingJsonLd } from '@cavuno/board/seo';

const { name, language } = await board.context();
const count = 42;
const heading = /* resolved page heading from your catalog */ '…';
// Application owns every display join — count, counter/particle, heading,
// separator, board name. Pieces (not a pasteable template):
// countLabel  = Intl.NumberFormat(language).format(count)
// heading     = catalog heading for this page
// boardName   = name
// Compose title and description in the board language (ja counters, RTL order,
// …). Do not hardcode number-then-noun or " | " order in shared helpers.
const countLabel = new Intl.NumberFormat(language).format(count);
const title = messages.listingTitle({ count, countLabel, heading, boardName: name });
const description = messages.listingDescription({
  count,
  countLabel,
  heading,
  boardName: name,
});

const head = listingHead({
  title,
  origin: 'https://jobs.example.com',
  path: '/jobs/robotics',
  description,
});

// Breadcrumb labels are application-owned (catalog), not English literals.
const objects = listingJsonLd({
  origin: 'https://jobs.example.com',
  breadcrumbs: [
    { name: messages.breadcrumb('home'), path: '/' },
    { name: messages.breadcrumb('jobs') },
  ],
  jobs: cards.map((card) => ({
    slug: card.slug,
    company: card.company,
  })),
});
```

`head.meta` contains title, description, and Open Graph descriptors;
`head.links` contains the canonical link. Title and description are whatever
you passed — the SDK does not join count, heading, or board name. Use a
locale-aware lowercasing API (not `.toLowerCase()`) when your copy needs case
folding.

This branch is complete when head descriptors reflect the resolved page
title and description, the canonical URL combines the intended origin and
path, and `listingJsonLd` receives card slugs plus company objects from the
listing response.
