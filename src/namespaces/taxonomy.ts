import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  PlacesListQuery,
  PublicPlace,
  PublicTaxonomyTerm,
  RemotePermitTaxonomyEntry,
  SuggestionsListQuery,
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

function taxonomyCollection(
  client: BoardClient,
  kind: 'categories' | 'skills',
) {
  return {
    ...taxonomyResolver(client, kind),
    list(query?: TaxonomyListQuery, options?: FetchOptions) {
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
    categories: taxonomyCollection(client, 'categories'),
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
    suggestions: {
      list(query?: SuggestionsListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicTaxonomyTerm>>('/suggestions', {
          ...options,
          query,
        });
      },
    },
    places: {
      ...taxonomyResolver(client, 'places'),
      /**
       * Without `query`: list every place used by a published job, with its
       * live job count (the locations directory). With `query.q` (≥2 chars):
       * location autocomplete — the top name matches ranked.
       */
      list(query?: PlacesListQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<PublicPlace>>('/places', {
          ...options,
          query,
        });
      },
    },
  };
}
