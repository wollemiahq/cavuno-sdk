import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope, SearchEnvelope } from '../types/common';
import type {
  CompaniesListQuery,
  CompaniesSearchBody,
  CompanyCategorySalary,
  CompanyJobsListQuery,
  CompanyListEnvelope,
  CompanyMarket,
  CompanyMarketsListQuery,
  CompanySalary,
  CompanySalarySummary,
  CompanySimilarQuery,
  PublicCompany,
  PublicCompanyDetail,
} from '../types/companies';
import type { JobCardListEnvelope } from '../types/jobs';
import type { SalaryDetailQuery } from '../types/salaries';
import type { TaxonomyResolution } from '../types/taxonomy';

export function companiesNamespace(client: BoardClient) {
  /**
   * List the board's company markets (sectors), ranked by company count — the
   * data behind the hosted companies index's market filter. The unsearched
   * list is fully paginated: follow `nextCursor` (or `paginate`) to enumerate
   * every market. Passing `search` returns a single top-N preview page.
   * Call `.resolve(slug)` to resolve a market slug to its canonical/source
   * form (and the 308 `redirectTo`) for the market-scoped company browse.
   *
   * @example
   * const { data } = await board.companies.markets({ search: 'robotics' });
   * const all = await paginate(board.companies.markets, { limit: 200 })
   *   .toArray({ limit: 5000 });
   * const market = await board.companies.markets.resolve('cybersecurity');
   */
  const markets = Object.assign(
    (query?: CompanyMarketsListQuery, options?: FetchOptions) =>
      client.fetch<ListEnvelope<CompanyMarket>>('/companies/markets', {
        ...options,
        query,
      }),
    {
      resolve(market: string, options?: FetchOptions) {
        return client.fetch<TaxonomyResolution>(
          `/companies/markets/${encodeURIComponent(market)}`,
          options,
        );
      },
    },
  );

  /**
   * A company's salary pages. `board.companies.salaries(slug)` is the
   * full overview; `.summary(slug)` is the lightweight profile teaser (overall +
   * top categories + sampleCount); `.category(slug, categorySlug)` is one job
   * category at the company. Pass `{ locale }` to the category call for
   * board-language names; it returns BOTH `categorySourceSlug` +
   * `categoryCanonicalSlug` (the consumer 308s to the canonical itself). Pass
   * `{ locale }` to the overview call too: its `topLocations` place names +
   * slugs and its `byCategory` names + slugs then come back in that language
   * (without it, top locations stay English). The company slug/name are never
   * localized.
   *
   * Prefer `.summary` for company profile / overview UIs — it skips seniority,
   * competitors, locations, and logo joins. Format currency ranges and
   * multi-locale UI strings in the app.
   *
   * @example
   * const overview = await board.companies.salaries('acme', { locale: 'de' });
   * const teaser = await board.companies.salaries.summary('acme');
   * const cat = await board.companies.salaries.category('acme', 'software-engineer', { locale: 'de' });
   */
  function overview(
    companySlug: string,
    query?: SalaryDetailQuery,
    options?: FetchOptions,
  ): Promise<CompanySalary>;
  /**
   * @deprecated Pass the fetch options third:
   * `salaries(slug, undefined, options)` or `salaries(slug, { locale }, options)`.
   */
  function overview(
    companySlug: string,
    options?: FetchOptions,
  ): Promise<CompanySalary>;
  function overview(
    companySlug: string,
    queryOrOptions?: SalaryDetailQuery | FetchOptions,
    maybeOptions?: FetchOptions,
  ): Promise<CompanySalary> {
    // The overview used to take the fetch options second. A query only ever
    // carries `locale`, which no fetch option is named, so the second slot's
    // `locale` is the query and anything else in it is the old options.
    const { locale, ...rest } = (queryOrOptions ?? {}) as SalaryDetailQuery &
      FetchOptions;
    const query = locale === undefined ? undefined : { locale };
    const options =
      Object.keys(rest).length > 0
        ? { ...(rest as FetchOptions), ...maybeOptions }
        : maybeOptions;
    return client.fetch<CompanySalary>(
      `/companies/${encodeURIComponent(companySlug)}/salaries`,
      query ? { ...options, query } : options,
    );
  }

  const salaries = Object.assign(overview, {
    summary(companySlug: string, options?: FetchOptions) {
      return client.fetch<CompanySalarySummary>(
        `/companies/${encodeURIComponent(companySlug)}/salaries/summary`,
        options,
      );
    },
    category(
      companySlug: string,
      categorySlug: string,
      query?: SalaryDetailQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<CompanyCategorySalary>(
        `/companies/${encodeURIComponent(companySlug)}/salaries/${encodeURIComponent(categorySlug)}`,
        { ...options, query },
      );
    },
  });

  return {
    /**
     * List companies on the board. Pass `marketSlug` to scope to one market.
     *
     * @example
     * const { data } = await board.companies.list({ limit: 20 });
     */
    list(query?: CompaniesListQuery, options?: FetchOptions) {
      return client.fetch<CompanyListEnvelope>('/companies', {
        ...options,
        query,
      });
    },

    /**
     * Retrieve one company by slug. The detail carries the company's `markets`.
     *
     * @example
     * const company = await board.companies.retrieve('acme');
     */
    retrieve(
      companySlug: string,
      query?: Record<string, never>,
      options?: FetchOptions,
    ) {
      return client.fetch<PublicCompanyDetail>(
        `/companies/${encodeURIComponent(companySlug)}`,
        { ...options, query },
      );
    },

    /**
     * Free-text company search.
     *
     * @example
     * const { data } = await board.companies.search({ query: 'acme' });
     */
    search(
      body: CompaniesSearchBody,
      query?: Record<string, never>,
      options?: FetchOptions,
    ) {
      return client.fetch<SearchEnvelope<PublicCompany>>('/companies/search', {
        ...options,
        method: 'POST',
        body,
        query,
      });
    },

    /**
     * List one company's published jobs.
     *
     * @example
     * const { data } = await board.companies.listJobs('acme', { limit: 10 });
     */
    listJobs(
      companySlug: string,
      query?: CompanyJobsListQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<JobCardListEnvelope>(
        `/companies/${encodeURIComponent(companySlug)}/jobs`,
        { ...options, query },
      );
    },

    /**
     * List companies similar to one company — the same ranking that powers the
     * hosted company page's similar-companies rail (most open roles first),
     * excluding the company itself.
     *
     * @example
     * const { data } = await board.companies.similar('acme', { limit: 6 });
     */
    similar(
      companySlug: string,
      query?: CompanySimilarQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<ListEnvelope<PublicCompany>>(
        `/companies/${encodeURIComponent(companySlug)}/similar`,
        { ...options, query },
      );
    },

    markets,
    salaries,
  };
}
