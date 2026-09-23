import type { BoardClient, FetchOptions } from '../client';
import type {
  PublicProfileFields,
  ProfileChoiceList,
  ProfileChoiceQuery,
  ProfileFieldEntity,
} from '../types/profile-fields';
export function profileFieldsNamespace(client: BoardClient) {
  return {
    /** Discover public scalar and catalog field definitions for a profile type. */
    retrieve(entity: ProfileFieldEntity, options?: FetchOptions) {
      return client.fetch<PublicProfileFields>(
        `/profile-fields/${encodeURIComponent(entity)}`,
        options,
      );
    },
    /** Discover active choices for a public catalog field; follow nextCursor for more. */
    choices(
      entity: ProfileFieldEntity,
      fieldKey: string,
      query?: ProfileChoiceQuery,
      options?: FetchOptions,
    ) {
      return client.fetch<ProfileChoiceList>(
        `/profile-fields/${encodeURIComponent(entity)}/${encodeURIComponent(fieldKey)}/choices`,
        { ...options, query },
      );
    },
  };
}
