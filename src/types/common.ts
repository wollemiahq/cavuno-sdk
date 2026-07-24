/**
 * Optional pagination metadata returned by Board API list operations.
 * These fields are intentionally defined at the public SDK boundary because
 * individual response schemas expose them inline rather than through a shared
 * OpenAPI component.
 */
export interface OffsetPagination {
  count?: number;
  limit?: number;
  offset?: number;
  gatedCount?: number;
}

/** @deprecated Use `OffsetPagination`. */
export type StorefrontPagination = OffsetPagination;

/** @deprecated Use `OffsetPagination`. */
export type JobCatalogPagination = OffsetPagination;

export type ListEnvelope<T> = OffsetPagination & {
  object: 'list';
  url: string;
  hasMore: boolean;
  /** `null` when `hasMore` is false — always present, never undefined. */
  nextCursor: string | null;
  data: T[];
};

export type SearchEnvelope<T> = OffsetPagination & {
  object: 'search_result';
  url: string;
  hasMore: boolean;
  nextCursor: string | null;
  data: T[];
};
