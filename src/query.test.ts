import { describe, expect, it } from 'vitest';

import { toSearchParams } from './query';

describe('toSearchParams', () => {
  it('serializes scalar params and skips undefined and null', () => {
    const params = toSearchParams({
      cursor: 'abc',
      limit: undefined,
      companyId: null,
    });
    expect(params.toString()).toBe('cursor=abc');
  });

  it('serializes arrays as repeated keys, never comma-joined', () => {
    const params = toSearchParams({ companyId: ['a', 'b'] });
    expect(params.toString()).toBe('companyId=a&companyId=b');
  });

  it('coerces numbers and booleans to strings', () => {
    const params = toSearchParams({ limit: 25, featured: true });
    expect(params.get('limit')).toBe('25');
    expect(params.get('featured')).toBe('true');
  });

  it('returns empty params for an empty or absent query', () => {
    expect(toSearchParams({}).toString()).toBe('');
    expect(toSearchParams(undefined).toString()).toBe('');
  });

  it('skips null and undefined entries inside arrays', () => {
    const params = toSearchParams({
      seniority: ['lead', undefined, null, 'senior'],
    });
    expect(params.toString()).toBe('seniority=lead&seniority=senior');
  });
});
