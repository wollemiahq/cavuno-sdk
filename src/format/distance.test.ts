import { describe, expect, it } from 'vitest';

import {
  defaultCommuteRadiusKm,
  defaultSearchRadius,
  distanceUnitForCountry,
  distanceUnitToKm,
  formatDistance,
  kmToDistanceUnit,
  kmToMiles,
  milesToKm,
  searchRadiusOptions,
} from './distance';

describe('distanceUnitForCountry', () => {
  it('uses miles in the US, GB, LR and MM', () => {
    for (const code of ['US', 'GB', 'LR', 'MM', 'us']) {
      expect(distanceUnitForCountry(code)).toBe('mi');
    }
  });

  it('uses kilometres elsewhere and when the country is unknown', () => {
    expect(distanceUnitForCountry('DE')).toBe('km');
    expect(distanceUnitForCountry('AU')).toBe('km');
    expect(distanceUnitForCountry(null)).toBe('km');
    expect(distanceUnitForCountry(undefined)).toBe('km');
  });
});

describe('defaultCommuteRadiusKm', () => {
  it('is 25 miles (stored as 40 km) in miles markets and 50 km elsewhere', () => {
    expect(defaultCommuteRadiusKm('US')).toBe(40);
    expect(Math.round(kmToMiles(defaultCommuteRadiusKm('GB')))).toBe(25);
    expect(defaultCommuteRadiusKm('AU')).toBe(50);
    expect(defaultCommuteRadiusKm(null)).toBe(50);
  });
});

describe('unit conversion', () => {
  it('round-trips miles and kilometres', () => {
    expect(milesToKm(30)).toBeCloseTo(48.28, 2);
    expect(kmToMiles(milesToKm(30))).toBeCloseTo(30, 10);
    expect(distanceUnitToKm(30, 'mi')).toBeCloseTo(48.28, 2);
    expect(distanceUnitToKm(30, 'km')).toBe(30);
    expect(kmToDistanceUnit(48.3, 'mi')).toBeCloseTo(30.01, 2);
    expect(kmToDistanceUnit(48.3, 'km')).toBe(48.3);
  });
});

describe('defaultSearchRadius', () => {
  it('is the 25 mi preset in miles and the 50 km preset in kilometres', () => {
    expect(defaultSearchRadius('mi')).toEqual(searchRadiusOptions('mi')[2]);
    expect(defaultSearchRadius('km')).toEqual(searchRadiusOptions('km')[3]);
    expect(defaultSearchRadius('km')).toEqual({
      value: 50,
      unit: 'km',
      km: 50,
    });
  });
});

describe('searchRadiusOptions', () => {
  it('offers 5, 10, 25, 50 and 100 in the display unit with kilometre values', () => {
    const miles = searchRadiusOptions('mi');
    expect(miles.map((option) => option.value)).toEqual([5, 10, 25, 50, 100]);
    expect(miles.every((option) => option.unit === 'mi')).toBe(true);
    expect(miles[0]?.km).toBeCloseTo(8.05, 2);
    expect(miles[4]?.km).toBeCloseTo(160.93, 2);

    expect(searchRadiusOptions('km')).toEqual([
      { value: 5, unit: 'km', km: 5 },
      { value: 10, unit: 'km', km: 10 },
      { value: 25, unit: 'km', km: 25 },
      { value: 50, unit: 'km', km: 50 },
      { value: 100, unit: 'km', km: 100 },
    ]);
  });

  it('stays inside the 1 to 250 km the jobs radius accepts', () => {
    for (const unit of ['mi', 'km'] as const) {
      for (const option of searchRadiusOptions(unit)) {
        expect(option.km).toBeGreaterThanOrEqual(1);
        expect(option.km).toBeLessThanOrEqual(250);
      }
    }
  });
});

describe('formatDistance', () => {
  it('labels a distance in its unit', () => {
    expect(formatDistance(25, 'mi', 'en')).toBe('25 mi');
    expect(formatDistance(10, 'km', 'en')).toBe('10 km');
  });
});
