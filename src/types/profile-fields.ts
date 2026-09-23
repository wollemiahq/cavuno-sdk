import type { Schemas } from './_spec';
export type PublicProfileFields = Schemas['PublicProfileFields'];
export type ProfileChoiceList = Schemas['ProfileChoiceList'];
export type ProfileFieldEntity = 'candidate' | 'company';
export type ProfileChoiceQuery = {
  search?: string;
  cursor?: string;
  limit?: number;
};
