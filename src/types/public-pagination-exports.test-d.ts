import type {
  JobCatalogPagination,
  OffsetPagination,
  StorefrontPagination,
} from '../index';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Condition extends true> = Condition;

export type OffsetPaginationIsPublic = Assert<
  Equal<OffsetPagination['count'], number | undefined>
>;

export type StorefrontPaginationRemainsCompatible = Assert<
  Equal<StorefrontPagination, OffsetPagination>
>;

export type JobCatalogPaginationRemainsCompatible = Assert<
  Equal<JobCatalogPagination, OffsetPagination>
>;
