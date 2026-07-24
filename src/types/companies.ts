// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. Response entities + named bodies alias the
// generated components; query types stay hand-written (no serializer to
// drift from).
import type { Schemas } from './_spec';
import type { ListEnvelope } from './common';
import type { RelatedSearch } from './jobs';

export type PublicCompany = Schemas['CompanyPublic'];

/** A market (sector) a company operates in — name + its source slug. */
export type CompanyMarketRef = Schemas['CompanyMarketRef'];

/** The company DETAIL shape — `PublicCompany` plus `markets` (detail-only). */
export type PublicCompanyDetail = Schemas['CompanyPublicDetail'];

/**
 * A company's salary overview: overall pay, by-seniority rows vs the
 * board baseline, top competitors, top locations, and a per-category summary.
 * Names are board-language localized; the company slug/name are not.
 */
export type CompanySalary = Schemas['CompanySalary'];

/**
 * A company's salary for one job category: the category's source + board-language
 * canonical slug, by-seniority vs the board-category baseline, and competitors in
 * the category. The category name is localized; the company name is not.
 */
export type CompanyCategorySalary = Schemas['CompanyCategorySalary'];

/** The companies browse list — `PublicCompany`s + `market` `relatedSearches`. */
export type CompanyListEnvelope = ListEnvelope<PublicCompany> & {
  relatedSearches?: RelatedSearch[];
};

export type CompaniesListQuery = {
  cursor?: string;
  /** Scope to a single market (sector) by slug. Unknown slugs 404. */
  marketSlug?: string;
  /** 1–100. */
  limit?: number;
  /**
   * Company catalog page offset (companies to skip); takes precedence over
   * `cursor`. Pair with the response `count` to page in parallel.
   */
  offset?: number;
};

export type CompanyJobsListQuery = {
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

export type CompanySimilarQuery = {
  /** 1–20, default 6. */
  limit?: number;
};

export type CompanyMarket = Schemas['CompanyMarket'];

export type CompanyMarketsListQuery = {
  /** 1–200, default 100 (a top-by-company-count preview). */
  limit?: number;
  search?: string;
};

export type CompaniesSearchBody = Schemas['PublicCompaniesSearchBody'];
