import type { BoardClient, FetchOptions } from '../client';
import type { ListEnvelope } from '../types/common';
import type {
  LocationSalaryDetail,
  LocationSkillsIndex,
  LocationTitlesIndex,
  SalaryCompany,
  SalaryDetailQuery,
  SalaryLocation,
  SalarySkill,
  SalaryTitle,
  SkillLocationSalary,
  SkillLocationsIndex,
  SkillSalaryDetail,
  TitleLocationSalary,
  TitleLocationsIndex,
  TitleSalaryDetail,
} from '../types/salaries';

/**
 * `board.salaries.*` — the board's salary pages, one nested resource
 * per axis. Each `retrieve(slug)` keys on the inbound (board-language or
 * English) slug and returns the breakdown plus `sourceSlug` + `canonicalSlug`;
 * the consumer 308s to `canonicalSlug` itself (the API never redirects). Pass
 * `{ locale }` for board-language names + canonical slugs.
 *
 * @example
 * const { data } = await board.salaries.titles.list({ locale: 'de' });
 * const title = await board.salaries.titles.retrieve('software-engineer');
 * const skill = await board.salaries.skills.retrieve('python', { locale: 'de' });
 * const place = await board.salaries.locations.retrieve('berlin');
 */
export function salariesNamespace(client: BoardClient) {
  return {
    /** The `/salaries/companies` hub — companies ranked by salary sample size. */
    companies: {
      list(options?: FetchOptions) {
        return client.fetch<ListEnvelope<SalaryCompany>>(
          '/salaries/companies',
          options,
        );
      },
    },
    titles: {
      list(query?: SalaryDetailQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<SalaryTitle>>('/salaries/titles', {
          ...options,
          query,
        });
      },
      retrieve(
        categorySlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<TitleSalaryDetail>(
          `/salaries/titles/${encodeURIComponent(categorySlug)}`,
          { ...options, query },
        );
      },
      /** The title's salary across locations (cross-axis). */
      locations(
        categorySlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<TitleLocationsIndex>(
          `/salaries/titles/${encodeURIComponent(categorySlug)}/locations`,
          { ...options, query },
        );
      },
      /** The title's salary in one place (cross-axis detail). */
      location(
        categorySlug: string,
        locationSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<TitleLocationSalary>(
          `/salaries/titles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(locationSlug)}`,
          { ...options, query },
        );
      },
    },
    skills: {
      list(query?: SalaryDetailQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<SalarySkill>>('/salaries/skills', {
          ...options,
          query,
        });
      },
      retrieve(
        skillSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<SkillSalaryDetail>(
          `/salaries/skills/${encodeURIComponent(skillSlug)}`,
          { ...options, query },
        );
      },
      /** The skill's salary across locations (cross-axis). */
      locations(
        skillSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<SkillLocationsIndex>(
          `/salaries/skills/${encodeURIComponent(skillSlug)}/locations`,
          { ...options, query },
        );
      },
      /** The skill's salary in one place (cross-axis detail). */
      location(
        skillSlug: string,
        locationSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<SkillLocationSalary>(
          `/salaries/skills/${encodeURIComponent(skillSlug)}/${encodeURIComponent(locationSlug)}`,
          { ...options, query },
        );
      },
    },
    locations: {
      /** The place hierarchy flattened to a list with `parentSlug` edges. */
      list(query?: SalaryDetailQuery, options?: FetchOptions) {
        return client.fetch<ListEnvelope<SalaryLocation>>(
          '/salaries/locations',
          { ...options, query },
        );
      },
      retrieve(
        locationSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<LocationSalaryDetail>(
          `/salaries/locations/${encodeURIComponent(locationSlug)}`,
          { ...options, query },
        );
      },
      /** The titles with salary data in one place (cross-axis). */
      titles(
        locationSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<LocationTitlesIndex>(
          `/salaries/locations/${encodeURIComponent(locationSlug)}/titles`,
          { ...options, query },
        );
      },
      /** The skills with salary data in one place (cross-axis). */
      skills(
        locationSlug: string,
        query?: SalaryDetailQuery,
        options?: FetchOptions,
      ) {
        return client.fetch<LocationSkillsIndex>(
          `/salaries/locations/${encodeURIComponent(locationSlug)}/skills`,
          { ...options, query },
        );
      },
    },
  };
}
