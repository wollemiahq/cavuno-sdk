import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  CategoryListQuery,
  PlaceSuggestQuery,
  PlacesListQuery,
  PublicPlace,
  PublicTaxonomyTerm,
  RemotePermitTaxonomyEntry,
  TaxonomyListQuery,
  TaxonomyResolution,
} from '../types/taxonomy';

function taxonomyResolver(
  client: BoardClient,
  kind: 'categories' | 'skills' | 'places',
) {
  return {
    /**
     * Resolve a (board-language or English) taxonomy slug to its page-meta.
     * Rejects with a `not_found` `BoardApiError` when the slug doesn't resolve.
     */
    resolve(slug: string, options?: FetchOptions) {
      return client.fetch<TaxonomyResolution>(
        `/${kind}/${encodeURIComponent(slug)}`,
        options,
      );
    },
  };
}

function taxonomyCollection<
  Query extends TaxonomyListQuery = TaxonomyListQuery,
>(client: BoardClient, kind: 'categories' | 'skills') {
  return {
    ...taxonomyResolver(client, kind),
    list(query?: Query, options?: FetchOptions) {
      return client.fetch<ListEnvelope<PublicTaxonomyTerm>>(`/${kind}`, {
        ...options,
        query,
      });
    },
  };
}

/**
 * `board.taxonomy.{categories,skills,places}.resolve(slug)` and the public
 * taxonomy collection methods. `places.list()` remains the
 * existing locations directory/autocomplete contract.
 */
export function taxonomyNamespace(client: BoardClient) {
  return {
    categories: taxonomyCollection<CategoryListQuery>(client, 'categories'),
    skills: taxonomyCollection(client, 'skills'),
    remotePermits: {
      /**
       * The canonical remote-permit option set (worldwide / regions / blocs
       * like EU / countries / subdivisions) — exactly what the API accepts
       * in `remotePermits` and job-posting `remoteWorkingPermits`. Platform
       * reference data served board-scoped; cacheable (6h on public boards).
       */
      list(options?: FetchOptions) {
        return client.fetch<ListEnvelope<RemotePermitTaxonomyEntry>>(
          '/remote-permits',
          options,
        );
      },
    },
    places: {
      ...taxonomyResolver(client, 'places'),
      /**
       * Without `query`: list every place used by a published job, with its
       * live job count (the locations directory). With `query.q` (≥2 chars):
       * location autocomplete — the top name matches ranked. Each place
       * carries its board-language `displayName` and `canonicalSlug`; link
       * with `canonicalSlug`.
       */
      list(query?: PlacesListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicPlace>>('/places', {
          ...options,
          query,
        });
      },
      /**
       * Location search beyond the board's own places: cities, towns,
       * suburbs and villages anywhere, in the board language, ranked by
       * size, name match and distance from `near`. Each place has `jobCount`
       * 0; its `canonicalSlug` works as the jobs `location` filter (jobs
       * within `radius` km of it), in `resolve`, and as the location page
       * slug. Show these after the board's own matches from `list({ q })`.
       * Returns an empty list when the board context's
       * `features.placeSuggestions` is `false`, so check it first. A
       * suggested place's `id` is not a `locationId` for job posting or
       * profiles; use its `slug` for job search.
       *
       * @example
       * const { data } = await board.taxonomy.places.suggest({
       *   q: 'marr',
       *   near: { lat: -33.87, lng: 151.21 },
       * });
       */
      suggest(query: PlaceSuggestQuery, options?: FetchOptions) {
        const { near, ...rest } = query;
        return client.fetch<ListEnvelope<PublicPlace>>('/places/suggest', {
          ...options,
          query: {
            ...rest,
            near: near ? `${near.lat},${near.lng}` : undefined,
          },
        });
      },
    },
  };
}
