---
name: cavuno-board-seo
description: Structured data + head builders for board frontends with @cavuno/board/seo — Google for Jobs JobPosting JSON-LD, breadcrumbs, blog Article/ProfilePage, salary-page Occupation/FAQ structured data, and listing <head> descriptors. Use when building a job-detail, listing, blog, or salary page and it needs JSON-LD or SEO meta tags, or whenever "structured data", "rich results", or "Google for Jobs" comes up.
---

# SEO: structured data + head builders

`@cavuno/board/seo` emits the exact structured data the hosted board emits —
tested against the hosted builders, so a tenant frontend gets Google
for Jobs, breadcrumb, blog, and salary rich results without reinventing (or
drifting from) the platform's rules. Render every builder's output into a
`<script type="application/ld+json">` tag; builders return `null` when there
is nothing worth emitting — skip the tag then.

## When to use

- A job detail page needs Google for Jobs `JobPosting` JSON-LD.
- Any page needs a `BreadcrumbList`.
- Blog post / author pages need `Article` / `ProfilePage` JSON-LD.
- Salary pages need `Occupation`/`MonetaryAmountDistribution`/`ItemList`/
  `FAQPage` structured data or the templated salary FAQ.
- A jobs-listing page needs its `<head>` (title with count, canonical, OG).

## When not to use

- Display text on the page itself — `cavuno-board-format`.
- Sitemaps and robots.txt — the sitemap module/skill.
- OG image generation and route maps — app-owned (see out of scope).

## Job-posting JSON-LD (the detail page)

`PublicJob` carries every field this needs — including the derived remote
permit codes. Worldwide-remote jobs automatically enumerate all 249
countries (Google requires a location signal next to TELECOMMUTE).

```ts snippet
import { createJobPostingJsonLd } from '@cavuno/board/seo';

const { name, logoUrl } = await board.context();
const job = await board.jobs.retrieve('senior-chef');

const jsonLd = createJobPostingJsonLd({
  job,
  board: { name, logoUrl },
  shareUrl: `https://jobs.example.com/companies/${job.company?.slug}/jobs/${job.slug}`,
});
// null when nothing renderable remains — omit the <script> tag then.
```

## Breadcrumbs

Hosted semantics: labels are trimmed, blank crumbs dropped, fewer than two
crumbs → `null`, and the current page (no `href`) omits `item`. Pass
absolute hrefs, or give `origin` and use paths:

```ts snippet
import { createBreadcrumbJsonLd } from '@cavuno/board/seo';

const trail = createBreadcrumbJsonLd(
  [
    { label: 'Home', href: '/' },
    { label: 'Jobs', href: '/jobs' },
    { label: job.title }, // current page — no href
  ],
  { origin: 'https://jobs.example.com' });
```

## Blog Article + author ProfilePage

```ts snippet
import {
  createBlogArticleJsonLd,
  createAuthorProfileJsonLd,
} from '@cavuno/board/seo';

const post = await board.blog.posts.retrieve('hello-world');
const article = createBlogArticleJsonLd({
  post,
  boardName: name,
  permalink: `https://jobs.example.com/blog/${post.slug}`,
  ogImageUrl: `https://jobs.example.com/blog/${post.slug}/og`, // fallback when no cover
});

const author = await board.blog.authors.retrieve('jane');
const { data: authorPosts } = await board.blog.posts.list({ authorSlug: 'jane' });
const profile = createAuthorProfileJsonLd({
  author,
  canonical: `https://jobs.example.com/blog/author/${author.slug}`,
  description: author.bio ?? `Posts by ${author.name}`,
  origin: 'https://jobs.example.com',
  posts: authorPosts, // newest first; the builder keeps 5 as hasPart
  totalPosts: authorPosts.length,
});
```

## Salary-page structured data + FAQ

The board language is a REQUIRED leading parameter wherever display strings
are produced (no `en` default). The money formatters are USD-hardcoded —
the hosted salary-page quirk, kept deliberately; the locale drives number
formatting only. The FAQ ships TEMPLATED English sentences (board-custom
FAQ copy is a not currently available and will supersede it).

```ts snippet
import {
  titleSalaryJsonLd,
  buildSalaryFaq,
  faqJsonLd,
  itemListJsonLd,
  formatRange,
  sortBySeniority,
} from '@cavuno/board/seo';

const { language } = await board.context();
const detail = await board.salaries.titles.retrieve('software-engineer');

const occupation = titleSalaryJsonLd(language, detail);
const faq = faqJsonLd(
  buildSalaryFaq(language, detail.categoryName, detail.overallSalary));
// Index pages: itemListJsonLd(items); on-page figures: formatRange(language, min, max)
// and sortBySeniority(detail.bySeniority) for the ladder table.
```

Also available: `skillSalaryJsonLd(detail)`, `locationSalaryJsonLd(detail)`
(city-level pages only), `crossAxisSalaryJsonLd(locale, args)`,
`companySalaryJsonLd(locale, detail)`,
`companyCategorySalaryJsonLd(locale, detail)`, `formatUsd(locale, value)`,
`formatSeniority(locale, key)`, `SENIORITY_ORDER`.

## Listing pages: head + structural JSON-LD

Locale-neutral pass-through — you supply the heading copy:

```ts snippet
import { listingHead, listingJsonLd } from '@cavuno/board/seo';

const head = listingHead({
  boardName: name,
  origin: 'https://jobs.example.com',
  path: '/jobs/robotics',
  heading: 'Robotics jobs',
  count: 42, // → "42 Robotics jobs | Acme Jobs"
});
// head.meta → title/description/OG descriptors; head.links → canonical.

const objects = listingJsonLd({
  origin: 'https://jobs.example.com',
  breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Jobs' }],
  jobs: cards.map((c) => ({ slug: c.slug, company: c.company })),
});
```

## Anti-patterns

```ts no-check
// NEVER hand-roll JobPosting JSON-LD — the pruning, salary mirroring, and
// worldwide country enumeration are Google-spec rules the SDK encodes:
const ld = { '@type': 'JobPosting', salary: job.salaryMin }; // wrong shape
// NEVER default the locale on salary builders:
titleSalaryJsonLd('en', detail); // hardcoded 'en' on a de board
// NEVER emit a JSON-LD script for a null builder result.
```

## Out of scope — do not invent exports

OG **image generation** (the `/og` card renderer), the legal/route **map**,
and the meta title/description **copy** (board SEO config + localized copy
is not replicated — `listingHead` takes your strings) are app-owned. No
sitemap builders here — that is `@cavuno/board/sitemap`'s job.

## Verify

- [ ] The job detail page's JSON-LD validates in Google's Rich Results test
      as a JobPosting, and a worldwide-remote job lists 249 countries.
- [ ] Pages with a null builder result render NO empty ld+json script.
- [ ] A de board passes `language` from `board.context()` — the salary
      FAQ figures render de-formatted, and no call site hardcodes 'en'.
- [ ] Breadcrumb JSON-LD only appears on pages with 2+ crumbs.
