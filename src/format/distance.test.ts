import { describe, expect, it } from 'vitest';

import {
  defaultCommuteRadiusKm,
  distanceUnitForCountry,
  distanceUnitToKm,
  kmToDistanceUnit,
  kmToMiles,
  milesToKm,
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
