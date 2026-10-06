/**
 * Commute distance helpers for the candidate profile's
 * `commuteRadiusKm` field. The API always speaks kilometres; a profile form
 * shows miles or kilometres by the candidate's home country, prefilled with
 * the market default when the candidate has not chosen a distance.
 */

/** ISO 3166-1 alpha-2 countries that measure road distance in miles. */
export const MILES_COUNTRIES = ['US', 'GB', 'LR', 'MM'] as const;

export type DistanceUnit = 'mi' | 'km';

/** Smallest commute distance the API accepts, in kilometres. */
export const COMMUTE_RADIUS_MIN_KM = 1;
/** Largest commute distance the API accepts, in kilometres. */
export const COMMUTE_RADIUS_MAX_KM = 250;

const KM_PER_MILE = 1.609344;

const MILES_COUNTRY_SET: ReadonlySet<string> = new Set(MILES_COUNTRIES);

function isMilesCountry(countryCode: string | null | undefined): boolean {
  return (
    typeof countryCode === 'string' &&
    MILES_COUNTRY_SET.has(countryCode.trim().toUpperCase())
  );
}

/** `mi` for the US, GB, LR and MM; `km` everywhere else, and when unknown. */
export function distanceUnitForCountry(
  countryCode: string | null | undefined,
): DistanceUnit {
  return isMilesCountry(countryCode) ? 'mi' : 'km';
}

/**
 * The commute distance used when a candidate has not set one: 25 miles
 * (40 km) in miles markets, 50 km elsewhere.
 */
export function defaultCommuteRadiusKm(
  countryCode: string | null | undefined,
): number {
  return isMilesCountry(countryCode) ? 40 : 50;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Convert a kilometre value to `unit` (no rounding). */
export function kmToDistanceUnit(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? kmToMiles(km) : km;
}

/** Convert a value in `unit` to kilometres (no rounding). */
export function distanceUnitToKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? milesToKm(value) : value;
}
