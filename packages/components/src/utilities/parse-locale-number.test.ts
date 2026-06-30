import { describe, expect, test } from 'bun:test';

import { parseLocaleNumber } from './parse-locale-number.ts';

describe('parseLocaleNumber', () => {
  test('empty string returns empty status', () => {
    expect(parseLocaleNumber('', 'en-US')).toEqual({ value: null, status: 'empty' });
    expect(parseLocaleNumber('   ', 'en-US')).toEqual({ value: null, status: 'empty' });
  });

  test('en-US: plain integers and decimals', () => {
    expect(parseLocaleNumber('123', 'en-US')).toEqual({ value: 123, status: 'valid' });
    expect(parseLocaleNumber('123.45', 'en-US')).toEqual({ value: 123.45, status: 'valid' });
    expect(parseLocaleNumber('.5', 'en-US')).toEqual({ value: 0.5, status: 'valid' });
    expect(parseLocaleNumber('0.', 'en-US')).toEqual({ value: 0, status: 'valid' });
    expect(parseLocaleNumber('+1', 'en-US')).toEqual({ value: 1, status: 'valid' });
    expect(parseLocaleNumber('-1.5', 'en-US')).toEqual({ value: -1.5, status: 'valid' });
  });

  test('en-US: grouped numbers', () => {
    expect(parseLocaleNumber('1,234', 'en-US')).toEqual({ value: 1234, status: 'valid' });
    expect(parseLocaleNumber('12,345,678', 'en-US')).toEqual({
      value: 12_345_678,
      status: 'valid',
    });
    expect(parseLocaleNumber('+1,234', 'en-US')).toEqual({ value: 1234, status: 'valid' });
  });

  test('en-US: strict grouping rejects bad grouping', () => {
    expect(parseLocaleNumber('1,2,3.4', 'en-US').status).toBe('malformed');
    expect(parseLocaleNumber('12,34,567', 'en-US').status).toBe('malformed');
    expect(parseLocaleNumber('1,23,456', 'en-US').status).toBe('malformed');
  });

  test('de-DE: . is group separator, , is decimal', () => {
    expect(parseLocaleNumber('1.234,5', 'de-DE')).toEqual({ value: 1234.5, status: 'valid' });
    expect(parseLocaleNumber('12.345.678', 'de-DE')).toEqual({
      value: 12_345_678,
      status: 'valid',
    });
    expect(parseLocaleNumber('1.2.3,4', 'de-DE').status).toBe('malformed');
  });

  test('fr-FR: narrow NBSP (U+202F) group separator round-trips', () => {
    const formatted = new Intl.NumberFormat('fr-FR').format(1234.5);
    // Sanity-check: should contain a narrow NBSP.
    expect(formatted).toContain(' ');
    const parsed = parseLocaleNumber(formatted, 'fr-FR');
    expect(parsed).toEqual({ value: 1234.5, status: 'valid' });
  });

  test('fr-FR: regular ASCII space is NOT a valid group separator', () => {
    // ASCII space between digits doesn't match fr-FR's narrow-NBSP separator.
    expect(parseLocaleNumber('1 234,5', 'fr-FR').status).toBe('malformed');
  });

  test('hi-IN: secondary grouping size of 2', () => {
    // hi-IN uses secondary=2, primary=3: 12,34,567 is malformed (en-US style)
    // but 1,23,456 / 12,34,567 / 1,23,45,678 are valid hi-IN groupings.
    const formatted = new Intl.NumberFormat('hi-IN').format(1234567);
    expect(parseLocaleNumber(formatted, 'hi-IN')).toEqual({ value: 1234567, status: 'valid' });
    expect(parseLocaleNumber('1,23,456', 'hi-IN')).toEqual({ value: 123456, status: 'valid' });
    expect(parseLocaleNumber('1,23,45,678', 'hi-IN')).toEqual({ value: 12345678, status: 'valid' });
    // en-US-style grouping (3,3,3) rejected on hi-IN.
    expect(parseLocaleNumber('1,234,567', 'hi-IN').status).toBe('malformed');
  });

  test('ar-EG: extended-Arabic digits round-trip', () => {
    const formatted = new Intl.NumberFormat('ar-EG').format(1234);
    expect(parseLocaleNumber(formatted, 'ar-EG')).toEqual({ value: 1234, status: 'valid' });
    // ASCII digits also accepted (permissive about digit system).
    expect(parseLocaleNumber('1234', 'ar-EG')).toEqual({ value: 1234, status: 'valid' });
  });

  test('ar-EG: negative value round-trips through localized minus sign', () => {
    // Regression: ar-EG minus may include directional marks (U+061C) that are
    // not ASCII '-'; the parser must normalize them before regex validation.
    const formatted = new Intl.NumberFormat('ar-EG').format(-1234);
    expect(parseLocaleNumber(formatted, 'ar-EG')).toEqual({ value: -1234, status: 'valid' });
  });

  test('normalizes a localized minus sign to ASCII minus', () => {
    expect(parseLocaleNumber('−123', 'fi-FI')).toEqual({ value: -123, status: 'valid' });
  });

  test('currency: USD format strips $ and grouping', () => {
    const fmt: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' };
    expect(parseLocaleNumber('$1,234.50', 'en-US', fmt)).toEqual({
      value: 1234.5,
      status: 'valid',
    });
  });

  test('currency: accounting-style ($1.00) round-trips to -1', () => {
    const fmt: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      currencySign: 'accounting',
    };
    const formatted = new Intl.NumberFormat('en-US', fmt).format(-1);
    if (!formatted.includes('(')) return; // engine doesn't honor accounting parens — skip
    expect(parseLocaleNumber(formatted, 'en-US', fmt)).toEqual({ value: -1, status: 'valid' });
  });

  test('percent: percent literal stripped', () => {
    const fmt: Intl.NumberFormatOptions = { style: 'percent' };
    expect(parseLocaleNumber('50%', 'en-US', fmt)).toEqual({ value: 50, status: 'valid' });
    expect(parseLocaleNumber('50', 'en-US', fmt)).toEqual({ value: 50, status: 'valid' });
  });

  test('malformed: rejects garbage', () => {
    expect(parseLocaleNumber('12abc', 'en-US').status).toBe('malformed');
    expect(parseLocaleNumber('1.2.3', 'en-US').status).toBe('malformed');
    expect(parseLocaleNumber('-', 'en-US').status).toBe('malformed');
    expect(parseLocaleNumber('$--5', 'en-US', { style: 'currency', currency: 'USD' }).status).toBe(
      'malformed',
    );
  });
});
