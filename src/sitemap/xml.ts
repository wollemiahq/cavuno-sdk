/**
 * Sitemap primitives — the pure XML + bucket-filename logic behind a board
 * frontend's `/sitemap.xml` index and `/sitemap/:file` bucket routes.
 * Mirrors the hosted board's 8-bucket model (`board-sitemap.loader.ts`): a
 * sitemap index points at one file per content bucket, each an ordinary
 * `<urlset>`.
 *
 * The XML byte layout transcribes the hosted serializers
 * (`sitemap-xml.utils.ts` — `serializeBoardSitemap` /
 * `serializeBoardSitemapIndex`) and is tested byte-equal against
 * them . `changefreq`/`priority` are deliberately not supported:
 * the hosted builders never emit them.
 *
 * Network enumeration lives in `walker.ts`; this module is pure so the
 * chunking + filename round-trip is unit-tested without a board.
 */

export const SITEMAP_BUCKETS = [
  'marketing',
  'jobs-categories',
  'jobs-skills',
  'jobs-locations',
  'jobs-details',
  'companies',
  'salaries',
  'blog',
] as const;

export type SitemapBucket = (typeof SITEMAP_BUCKETS)[number];

/** Matches the hosted chunk size so the two corpora line up bucket-for-bucket. */
export const SITEMAP_CHUNK_SIZE = 45_000;

export function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Chunk 0 (or no chunk) → the bare bucket filename; chunks 1+ append `-2`,
 * `-3`, … so the common single-chunk case has the cleanest URL. The scheme
 * is the filename component of the hosted `getBoardSitemapBucketPath`.
 */
export function bucketFilename(bucket: SitemapBucket, chunkIndex = 0): string {
  const suffix = chunkIndex > 0 ? `-${chunkIndex + 1}` : '';
  return `${bucket}${suffix}.xml`;
}

/** Inverse of `bucketFilename`; returns null for unknown buckets / non-xml. */
export function parseBucketFilename(
  filename: string,
): { bucket: SitemapBucket; chunkIndex: number } | null {
  if (!filename.endsWith('.xml')) return null;
  const stem = filename.slice(0, -'.xml'.length);

  const chunkMatch = stem.match(/^(.+?)-(\d+)$/);
  if (chunkMatch) {
    const candidate = chunkMatch[1] as SitemapBucket;
    const chunkNumber = Number.parseInt(chunkMatch[2] ?? '', 10);
    if (
      SITEMAP_BUCKETS.includes(candidate) &&
      Number.isFinite(chunkNumber) &&
      chunkNumber >= 2
    ) {
      return { bucket: candidate, chunkIndex: chunkNumber - 1 };
    }
  }

  if (SITEMAP_BUCKETS.includes(stem as SitemapBucket)) {
    return { bucket: stem as SitemapBucket, chunkIndex: 0 };
  }

  return null;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  if (items.length <= size) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';

/**
 * One `<url>` entry. A bare string is shorthand for `{ url }` — the walker
 * emits plain URL strings; hosted-shaped entries carry `lastModified` (and
 * `images` on job-detail entries: the company logo).
 */
export interface SitemapUrlEntry {
  url: string;
  /** A `Date` serializes to ISO 8601; a string passes through as-is. */
  lastModified?: Date | string;
  /** Google image-sitemap extension URLs (adds the `xmlns:image` namespace). */
  images?: readonly string[];
}

export interface SitemapIndexEntry {
  url: string;
  lastModified?: Date | string;
}

function lastmod(value: Date | string): string {
  const serialized = value instanceof Date ? value.toISOString() : value;
  return `<lastmod>${xmlEscape(serialized)}</lastmod>\n`;
}

export function renderUrlset(
  entries: readonly (string | SitemapUrlEntry)[],
): string {
  const normalized = entries.map((entry) =>
    typeof entry === 'string' ? { url: entry } : entry,
  );

  const hasImages = normalized.some((entry) => (entry.images?.length ?? 0) > 0);
  const namespaces = [`xmlns="${SITEMAP_NS}"`];
  if (hasImages) {
    namespaces.push(`xmlns:image="${IMAGE_NS}"`);
  }

  let xml = XML_DECLARATION + `<urlset ${namespaces.join(' ')}>\n`;

  for (const entry of normalized) {
    xml += '<url>\n';
    xml += `<loc>${xmlEscape(entry.url)}</loc>\n`;

    if (entry.images?.length) {
      for (const image of entry.images) {
        xml += `<image:image>\n<image:loc>${xmlEscape(image)}</image:loc>\n</image:image>\n`;
      }
    }

    if (entry.lastModified) {
      xml += lastmod(entry.lastModified);
    }

    xml += '</url>\n';
  }

  xml += '</urlset>\n';

  return xml;
}

export function renderSitemapIndex(
  entries: readonly (string | SitemapIndexEntry)[],
): string {
  let xml = XML_DECLARATION + `<sitemapindex xmlns="${SITEMAP_NS}">\n`;

  for (const raw of entries) {
    const entry = typeof raw === 'string' ? { url: raw } : raw;
    xml += '<sitemap>\n';
    xml += `<loc>${xmlEscape(entry.url)}</loc>\n`;

    if (entry.lastModified) {
      xml += lastmod(entry.lastModified);
    }

    xml += '</sitemap>\n';
  }

  xml += '</sitemapindex>\n';

  return xml;
}
