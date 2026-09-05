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
 * Two paths, in priority order:
 *
 *  1. MIRROR (preferred). `board.sitemap()` lists the buckets the board
 *     publishes and `board.sitemap.entries(bucket)` pages their board-relative
 *     paths — the board's own sitemap, served from its build cache. Mirroring
 *     it makes the generated sitemap equal to the board's by construction, and
 *     closes the cross-axis gap the legacy path could not: the cross-axis
 *     salary pages (title×location, skill×location, company×category, plus the
 *     per-entity `/locations` · `/titles` · `/skills` index pages) and the jobs
 *     place×category / place×skill combinations. It is also far cheaper —
 *     a handful of cached reads instead of ~25 catalog calls per build.
 *
 *  2. LEGACY (fallback). Against an API that predates the sitemap endpoints
 *     (404), the walker re-derives each bucket from the catalog endpoints as
 *     before, thin-content floors and all. That path still cannot emit the
 *     cross-axis families — they are reachable via internal links only.
 *
 * Any error other than a 404 propagates: a 500 or a timeout must fail the
 * build loudly, not silently downgrade to a smaller sitemap.
 *
 * Freshness: the mirror path publishes a `lastModified` per URL and per
 * bucket. `buildBucketEntries` / `listedBucketEntries` carry it through to
 * the serializers so each `<url>` and `<sitemap>` gets a `<lastmod>`; the
 * older `buildBucketUrls` / `listedBuckets` return the bare names and stay
 * exactly as they were.
 */
import { isNotFound } from '../errors';
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
import {
  SITEMAP_BUCKETS,
  type SitemapBucket,
  type SitemapUrlEntry,
} from './xml';

import type { FetchOptions } from '../client';
import type {
  BoardSdk,
  CompanyMarket,
  CompanyMarketsListQuery,
  PublicBlogPostSummary,
  PublicCompany,
  PublicJobCard,
  SalaryLocation,
  SitemapEntriesQuery,
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

/** Page size for the mirror walk — the sitemap entries endpoint's maximum. */
const MIRROR_PAGE = 1000;

/**
 * Which buckets the index lists.
 *
 * Mirror path: exactly the buckets the board publishes, in the canonical
 * `SITEMAP_BUCKETS` order (the board omits empty ones).
 *
 * Legacy fallback (404): blog is gated by its feature; the rest emit an empty
 * urlset when a board lacks that content (valid, just zero URLs).
 */
export async function listedBuckets(board: BoardSdk): Promise<SitemapBucket[]> {
  const listed = await listedBucketEntries(board);
  return listed.map((entry) => entry.bucket);
}

/**
 * One listed bucket, with the freshness stamp the board publishes for it.
 *
 * `lastModified` is present only on the mirror path, and only for the buckets
 * the board tracks one for — the legacy fallback has no such stamp, so it
 * yields bucket names alone. Feed these straight to `renderSitemapIndex` and
 * each `<sitemap>` gets a `<lastmod>`.
 */
export interface ListedSitemapBucket {
  bucket: SitemapBucket;
  /** ISO 8601 timestamp of the newest content in the bucket, when known. */
  lastModified?: string;
}

/**
 * Like `listedBuckets`, but keeps each bucket's `lastModified`. Same two
 * paths, same ordering, same error rules — the only difference is that the
 * freshness stamp survives.
 */
export async function listedBucketEntries(
  board: BoardSdk,
): Promise<ListedSitemapBucket[]> {
  try {
    const index = await board.sitemap();
    const published = new Map(
      index.buckets.map((entry) => [entry.bucket, entry.lastModified]),
    );
    return SITEMAP_BUCKETS.filter((bucket) => published.has(bucket)).map(
      (bucket) => {
        const lastModified = published.get(bucket);
        return lastModified === undefined
          ? { bucket }
          : { bucket, lastModified };
      },
    );
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { features } = await board.context();
    return SITEMAP_BUCKETS.filter((b) => b !== 'blog' || features.blog).map(
      (bucket) => ({ bucket }),
    );
  }
}

export async function buildBucketUrls(
  board: BoardSdk,
  origin: string,
  bucket: SitemapBucket,
): Promise<string[]> {
  const entries = await buildBucketEntries(board, origin, bucket);
  return entries.map((entry) => entry.url);
}

/**
 * Like `buildBucketUrls`, but keeps each URL's `lastModified` where the board
 * publishes one. The result feeds `renderUrlset` directly, so every `<url>`
 * that has a freshness stamp gets a `<lastmod>` — the signal crawlers use to
 * prioritise recrawl across a large sitemap.
 *
 * On the legacy fallback path the catalog endpoints expose no per-URL stamp,
 * so entries come back as `{ url }` only — identical output to
 * `buildBucketUrls`, just in the wider shape.
 */
export async function buildBucketEntries(
  board: BoardSdk,
  origin: string,
  bucket: SitemapBucket,
): Promise<SitemapUrlEntry[]> {
  try {
    return await mirrorBucketEntries(board, origin, bucket);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const urls = await legacyBucketUrls(board, origin, bucket);
    return urls.map((url) => ({ url }));
  }
}

/**
 * The mirror path: page the board's own entries for the bucket and prefix each
 * board-relative path with the caller's origin. Order is preserved — it is the
 * order the board emits, so the two corpora line up entry for entry. Each
 * entry's `lastModified` is carried through when the board sends one.
 */
async function mirrorBucketEntries(
  board: BoardSdk,
  origin: string,
  bucket: SitemapBucket,
): Promise<SitemapUrlEntry[]> {
  const pages = paginate(
    (query?: SitemapEntriesQuery, options?: FetchOptions) =>
      board.sitemap.entries(bucket, query, options),
    { limit: MIRROR_PAGE },
  ).pages();

  const entries: SitemapUrlEntry[] = [];
  for await (const page of pages) {
    for (const entry of page.data) {
      const url = `${origin}${entry.path}`;
      entries.push(
        entry.lastModified === undefined
          ? { url }
          : { url, lastModified: entry.lastModified },
      );
    }
  }
  return entries;
}

async function legacyBucketUrls(
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

/** Markets page size — the list endpoint's maximum. */
const MARKETS_PAGE = 200;

async function companies(board: BoardSdk, origin: string): Promise<string[]> {
  const [list, markets] = await Promise.all([
    enumerateCompanies(board),
    // Paginate: the unsearched market list is a full cursor walk, and a single
    // call used to stop at the first page — silently dropping every market
    // page past it on a board with many sectors. An older API that ignores the
    // cursor answers `hasMore: false`, so this degrades to one call there.
    drainPages<CompanyMarket>(
      paginate(
        (query?: CompanyMarketsListQuery, options?: FetchOptions) =>
          board.companies.markets(query, options),
        { limit: MARKETS_PAGE },
      ).pages(),
    ),
  ]);
  const urls = [`${origin}${BOARD_PATHS.companies}`];
  for (const company of list)
    urls.push(`${origin}${companyPath(company.slug)}`);
  for (const market of markets) {
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
  // emitted on this legacy path — the API exposes them only per-slug. The
  // mirror path above covers them; see the file header.
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
