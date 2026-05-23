import { describe, expect, test } from 'bun:test';

import {
  computeNationalResult,
  digitsOnly,
  displayNameForCountry,
  formatNationalAsYouType,
  parseE164Value,
  resolveCountryList,
  stripFormatting,
} from './phone-input-formatting.ts';

describe('phone-input-formatting helpers', () => {
  test('digitsOnly strips non-digits', () => {
    expect(digitsOnly('+1 (415) 555-0132')).toBe('14155550132');
  });

  test('stripFormatting keeps leading plus', () => {
    expect(stripFormatting('+1 (415) 555-0132')).toBe('+14155550132');
  });
});

describe('formatNationalAsYouType', () => {
  test('formats US numbers in chunks', () => {
    expect(formatNationalAsYouType('US', '4155550132')).toBe('(415) 555-0132');
  });

  test('formats GB numbers using national conventions', () => {
    // London 020 7946 0958
    const formatted = formatNationalAsYouType('GB', '02079460958');
    expect(formatted).toContain('020');
    expect(formatted).toContain('7946');
  });

  test('returns empty string for empty input', () => {
    expect(formatNationalAsYouType('US', '')).toBe('');
  });
});

describe('computeNationalResult', () => {
  test('empty digits produce reason "empty"', () => {
    const result = computeNationalResult('US', '');
    expect(result.reason).toBe('empty');
    expect(result.value).toBe('');
    expect(result.isPossible).toBe(false);
    expect(result.isValid).toBe(false);
  });

  test('partially typed US number is incomplete', () => {
    const result = computeNationalResult('US', '415');
    expect(result.value).toBe('');
    expect(['incomplete', 'invalid']).toContain(result.reason);
    expect(result.isValid).toBe(false);
  });

  test('valid US number yields E.164', () => {
    const result = computeNationalResult('US', '4155550132');
    expect(result.reason).toBe('valid');
    expect(result.value).toBe('+14155550132');
    expect(result.isValid).toBe(true);
    expect(result.isPossible).toBe(true);
    expect(result.nationalNumber).toBe('4155550132');
  });

  test('valid GB number yields E.164', () => {
    const result = computeNationalResult('GB', '02079460958');
    expect(result.value).toBe('+442079460958');
    expect(result.isValid).toBe(true);
  });
});

describe('parseE164Value', () => {
  test('parses a US E.164 value', () => {
    const result = parseE164Value('+14155550132');
    expect(result).not.toBeNull();
    expect(result?.country).toBe('US');
    expect(result?.nationalNumber).toBe('4155550132');
    expect(result?.isValid).toBe(true);
  });

  test('returns null for empty input', () => {
    expect(parseE164Value('')).toBeNull();
  });

  test('returns null for garbage input', () => {
    expect(parseE164Value('not-a-phone')).toBeNull();
  });
});

describe('resolveCountryList', () => {
  test('returns all supported countries when no allow-list provided', () => {
    const { countries, usedFallback } = resolveCountryList(undefined);
    expect(countries.length).toBeGreaterThan(100);
    expect(usedFallback).toBe(false);
  });

  test('filters allow-list to supported, unique codes', () => {
    const { countries, usedFallback } = resolveCountryList(['US', 'GB', 'US' as const]);
    expect(countries).toEqual(['US', 'GB']);
    expect(usedFallback).toBe(false);
  });

  test('falls back to ["US"] when allow-list is empty after filtering', () => {
    const { countries, usedFallback } = resolveCountryList([
      // intentionally junk codes
      'ZZ' as never,
      'XX' as never,
    ]);
    expect(countries).toEqual(['US']);
    expect(usedFallback).toBe(true);
  });
});

describe('displayNameForCountry', () => {
  test('returns the English country name for US', () => {
    expect(displayNameForCountry('US', 'en-US')).toContain('United States');
  });

  test('falls back to the country code when locale is unknown', () => {
    expect(displayNameForCountry('US', 'not-a-locale')).toBeTruthy();
  });
});
