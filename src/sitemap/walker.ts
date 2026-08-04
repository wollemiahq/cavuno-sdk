/**
 * Sitemap enumeration — turns a board's content into the URL list for each
 * bucket of the 8-bucket model (see `xml.ts`). Pure logic with injected
 * I/O: every read arrives through the `BoardSdk` instance the caller
 * passes, so the walker is platform-neutral and unit-testable with a
 * stubbed client.
 *
 * Locale: no locale parameter is needed. Job, company, market, and blog
 * slugs arrive on the wire already board-language canonical; the salary
 * index lists take a `locale` query (en = identity fast-path) and the
 * walker passes `context().language`, so emitted salary URLs are
 * board-language canonical too.
 *
 * What the v1 API can enumerate cleanly is emitted in full; two families it
 * exposes only per-slug are deliberately NOT emitted (documented inline):
 *  - cross-axis salary pages (title×location, skill×location, company×category)
 *  - jobs place×category / place×skill combinations
 * Both need a bulk-pairs endpoint; per-slug N+1 (~1k+ calls/build) is wrong
 * for a cache-less Worker. They stay reachable
 * via internal links until that endpoint lands.
 */
import { paginate } from '../pagination';
import {
  BOARD_PATHS,
  blogAuthorPath,
  blogPostPath,
  blogTagPath,
  companyMarketPath,
  companyPath,
  companySalaryPath,
  jobDetailPath,
  jobsCategoryPath,
  jobsLocationPath,
  jobsSkillPath,
  salaryLocationPath,
  salarySkillPath,
  salaryTitlePath,
} from '../paths';
import { SITEMAP_BUCKETS, type SitemapBucket } from './xml';

import type {
  BoardSdk,
  PublicBlogPostSummary,
  PublicCompany,
  PublicJobCard,
  SalaryLocation,
} from '../index';

/** Matches the hosted thin-content floor: a listing page needs ≥5 jobs to index. */
export const MIN_JOBS_PER_INDEXED_PAGE = 5;

/** Cursor-loop backstop (hosted parity). 200×100 = 20k pages of any one list. */
const MAX_PAGES = 200;

/**
 * Collect a cursor walk to exhaustion, capped at `MAX_PAGES` pages. Warns
 * (and truncates) only when the cap is hit with more pages remaining.
 */
async function drainPages<T>(
  pages: AsyncGenerator<{ data: T[]; hasMore: boolean }, void, undefined>,
): Promise<T[]> {
  const acc: T[] = [];
  let pageCount = 0;
  for await (const page of pages) {
    acc.push(...page.data);
    pageCount += 1;
    if (pageCount >= MAX_PAGES) {
      if (page.hasMore) {
        console.warn(
          `[sitemap] hit the ${MAX_PAGES}-page pagination cap — output may be truncated`,
        );
      }
      break;
    }
  }
  return acc;
}

const PAGE = 100;
const OFFSET_CONCURRENCY = 8;
/** API constraint on the offset window: `offset + limit ≤ 10,000`. */
const OFFSET_CEILING = 10_000;

/**
 * Enumerate a list BY OFFSET IN PARALLEL when the endpoint exposes a total
 * `count`. Sequential cursor pagination blows the Worker time budget on a real
 * board — the prod sitemap check hit ~46s on the jobs and companies buckets.
 * `fetchAt(offset)` returns one page at an absolute offset; `fallback` is the
 * sequential cursor crawl, used when the envelope omits `count` (an older API).
 * Order can shift between offset requests on a churning board — harmless for a
 * sitemap (URLs dedupe; the ≥5 taxonomy counts are a heuristic).
 */
async function enumerateByOffset<T>(
  fetchAt: (offset: number) => Promise<{ data: T[]; count?: number }>,
  fallback: () => Promise<T[]>,
): Promise<T[]> {
  const first = await fetchAt(0);
  if (first.count === undefined) return fallback();

  const all = [...first.data];
  const ceiling = Math.min(first.count, OFFSET_CEILING);
  const offsets: number[] = [];
  for (let o = PAGE; o < ceiling; o += PAGE) offsets.push(o);

  for (let i = 0; i < offsets.length; i += OFFSET_CONCURRENCY) {
    const pages = await Promise.all(
      offsets.slice(i, i + OFFSET_CONCURRENCY).map(fetchAt),
    );
    for (const page of pages) all.push(...page.data);
  }

  if (first.count > OFFSET_CEILING) {
    console.warn(
      `[sitemap] count ${first.count} exceeds the ${OFFSET_CEILING} offset ceiling — tail not enumerated (needs cursor/bulk support).`,
    );
  }
  return all;
}

/** Jobs carry the offset in an explicit `offset` param. */
function enumerateJobs(board: BoardSdk): Promise<PublicJobCard[]> {
  return enumerateByOffset(
    (offset) => board.jobs.list({ limit: PAGE, offset }),
    () => drainPages(paginate(board.jobs.list, { limit: PAGE }).pages()),
  );
}

function enumerateCompanies(board: BoardSdk): Promise<PublicCompany[]> {
  return enumerateByOffset(
    (offset) => board.companies.list({ limit: PAGE, offset }),
    () => drainPages(paginate(board.companies.list, { limit: PAGE }).pages()),
  );
}

/** Which buckets the index lists. Blog is gated by its feature; the rest emit an empty urlset when a board lacks that content (valid, just zero URLs). */
export async function listedBuckets(board: BoardSdk): Promise<SitemapBucket[]> {
  const { features } = await board.context();
  return SITEMAP_BUCKETS.filter((b) => b !== 'blog' || features.blog);
}

export async function buildBucketUrls(
  board: BoardSdk,
  origin: string,
  bucket: SitemapBucket,
): Promise<string[]> {
  switch (bucket) {
    case 'marketing':
      return marketing(board, origin);
    case 'jobs-categories':
      return jobsTaxonomy(board, origin, 'categories');
    case 'jobs-skills':
      return jobsTaxonomy(board, origin, 'skills');
    case 'jobs-locations':
      return jobsLocations(board, origin);
    case 'jobs-details':
      return jobDetails(board, origin);
    case 'companies':
      return companies(board, origin);
    case 'salaries':
      return salaries(board, origin);
    case 'blog':
      return blog(board, origin);
  }
}

async function marketing(board: BoardSdk, origin: string): Promise<string[]> {
  const { features } = await board.context();
  const urls = [
    `${origin}${BOARD_PATHS.home}`,
    `${origin}${BOARD_PATHS.jobs}`,
    `${origin}${BOARD_PATHS.about}`,
    `${origin}${BOARD_PATHS.privacyPolicy}`,
    `${origin}${BOARD_PATHS.termsOfService}`,
    `${origin}${BOARD_PATHS.cookiePolicy}`,
  ];
  if (features.impressum) urls.push(`${origin}${BOARD_PATHS.impressum}`);
  // A sitemap advertises pages to crawlers, so only the PUBLIC directory
  // belongs in it. `employers_only` gates the page behind an approved
  // employer session: a crawler following the link gets the gate, not the
  // directory, which is a thin/soft-404 signal on an otherwise indexable
  // board. (Note `'off'` is a truthy string — this must be an equality test,
  // not a truthiness one.)
  if (features.talentDirectory === 'public')
    urls.push(`${origin}${BOARD_PATHS.talent}`);
  if (features.employers) urls.push(`${origin}${BOARD_PATHS.employers}`);
  return urls;
}

async function jobsTaxonomy(
  board: BoardSdk,
  origin: string,
  kind: 'categories' | 'skills',
): Promise<string[]> {
  const jobs = await enumerateJobs(board);

  // Count distinct jobs per taxonomy slug (a Set per job dedupes within a job);
  // emit only slugs at/above the thin-content floor, matching the hosted bucket.
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const slugs = new Set(
      (kind === 'categories' ? job.categories : job.skills).map((t) => t.slug),
    );
    for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const toPath = kind === 'categories' ? jobsCategoryPath : jobsSkillPath;
  return [...counts.entries()]
    .filter(([, n]) => n >= MIN_JOBS_PER_INDEXED_PAGE)
    .map(([slug]) => slug)
    .sort()
    .map((slug) => `${origin}${toPath(slug)}`);
}

async function jobsLocations(
  board: BoardSdk,
  origin: string,
): Promise<string[]> {
  // The v1 job card omits place slugs and `taxonomy.places.list` is an
  // autocomplete (top ~10), so the salary-location index is the available
  // complete source of board job-location slugs (placeSlug + jobCount).
  const { language } = await board.context();
  const { data } = await board.salaries.locations.list({ locale: language });
  return data
    .filter(
      (location: SalaryLocation) =>
        location.jobCount >= MIN_JOBS_PER_INDEXED_PAGE,
    )
    .map((location: SalaryLocation) => location.placeSlug)
    .sort()
    .map((slug: string) => `${origin}${jobsLocationPath(slug)}`);
}

async function jobDetails(board: BoardSdk, origin: string): Promise<string[]> {
  const jobs = await enumerateJobs(board);
  const seen = new Set<string>();
  for (const job of jobs) {
    if (!job.company?.slug || !job.slug) continue;
    seen.add(`${origin}${jobDetailPath(job.company.slug, job.slug)}`);
  }
  return [...seen].sort();
}

async function companies(board: BoardSdk, origin: string): Promise<string[]> {
  const [list, markets] = await Promise.all([
    enumerateCompanies(board),
    board.companies.markets(),
  ]);
  const urls = [`${origin}${BOARD_PATHS.companies}`];
  for (const company of list)
    urls.push(`${origin}${companyPath(company.slug)}`);
  for (const market of markets.data) {
    urls.push(`${origin}${companyMarketPath(market.slug)}`);
  }
  return urls;
}

async function salaries(board: BoardSdk, origin: string): Promise<string[]> {
  const { language } = await board.context();
  const [salaryCompanies, titles, skills, locations] = await Promise.all([
    board.salaries.companies.list(),
    board.salaries.titles.list({ locale: language }),
    board.salaries.skills.list({ locale: language }),
    board.salaries.locations.list({ locale: language }),
  ]);

  if (
    !salaryCompanies.data.length &&
    !titles.data.length &&
    !skills.data.length &&
    !locations.data.length
  ) {
    return [];
  }

  const urls = [`${origin}${BOARD_PATHS.salaries}`];
  if (salaryCompanies.data.length) {
    urls.push(`${origin}${BOARD_PATHS.salaryCompanies}`);
    for (const c of salaryCompanies.data) {
      urls.push(`${origin}${companySalaryPath(c.companySlug)}`);
    }
  }
  if (titles.data.length) {
    urls.push(`${origin}${BOARD_PATHS.salaryTitles}`);
    for (const t of titles.data)
      urls.push(`${origin}${salaryTitlePath(t.slug)}`);
  }
  if (skills.data.length) {
    urls.push(`${origin}${BOARD_PATHS.salarySkills}`);
    for (const s of skills.data)
      urls.push(`${origin}${salarySkillPath(s.slug)}`);
  }
  if (locations.data.length) {
    urls.push(`${origin}${BOARD_PATHS.salaryLocations}`);
    for (const l of locations.data) {
      urls.push(`${origin}${salaryLocationPath(l.placeSlug)}`);
    }
  }
  // Cross-axis salary pages (title×location, skill×location, company×category,
  // and the per-entity /locations · /titles · /skills index pages) are NOT
  // emitted — see the file header. Tracked as a named future release.
  return urls;
}

async function blog(board: BoardSdk, origin: string): Promise<string[]> {
  const posts = await drainPages<PublicBlogPostSummary>(
    paginate(board.blog.posts.list, { limit: 100 }).pages(),
  );
  const urls = [`${origin}${BOARD_PATHS.blog}`];
  // Tags + authors come from the published posts' embeds — exactly like the
  // hosted sitemap, which emits a tag/author page only when it appears on a
  // published post (not for empty, post-less tags/authors → no thin pages).
  const tagSlugs = new Set<string>();
  const authorSlugs = new Set<string>();
  for (const post of posts) {
    urls.push(`${origin}${blogPostPath(post.slug)}`);
    for (const tag of post.tags) tagSlugs.add(tag.slug);
    for (const author of post.authors) authorSlugs.add(author.slug);
  }

  for (const slug of [...tagSlugs].sort())
    urls.push(`${origin}${blogTagPath(slug)}`);
  for (const slug of [...authorSlugs].sort()) {
    urls.push(`${origin}${blogAuthorPath(slug)}`);
  }
  return urls;
}
