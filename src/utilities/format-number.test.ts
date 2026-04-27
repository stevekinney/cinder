import { beforeAll, describe, expect, test } from 'bun:test';

import { formatNumber } from './format-number.ts';

beforeAll(() => {
  if (process.env.TZ !== 'UTC') {
    throw new Error(
      'format-number.test.ts requires TZ=UTC. Run via `bun run test`, not bare `bun test`.',
    );
  }
});

describe('formatNumber', () => {
  test('formats an integer with default locale (en-US)', () => {
    expect(formatNumber(42)).toBe('42');
  });

  test('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  test('formats negative integers', () => {
    expect(formatNumber(-7)).toBe('-7');
  });

  test('formats decimals with default precision', () => {
    // Default Intl.NumberFormat keeps up to 3 fraction digits.
    expect(formatNumber(3.14, 'en-US')).toBe('3.14');
  });

  test('inserts thousands separators for large numbers (en-US)', () => {
    expect(formatNumber(1_234_567, 'en-US')).toBe('1,234,567');
  });

  test('honors locale override (de-DE uses dot as thousands separator)', () => {
    expect(formatNumber(1_234_567, 'de-DE')).toBe('1.234.567');
  });

  test('honors options override — fixed fraction digits', () => {
    expect(
      formatNumber(3.14159, 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ).toBe('3.14');
  });

  test('honors options override — currency', () => {
    expect(formatNumber(1_500, 'en-US', { style: 'currency', currency: 'USD' })).toBe('$1,500.00');
  });

  test('honors options override — percent', () => {
    expect(formatNumber(0.42, 'en-US', { style: 'percent' })).toBe('42%');
  });

  test('disables grouping when useGrouping is false', () => {
    expect(formatNumber(1_234_567, 'en-US', { useGrouping: false })).toBe('1234567');
  });
});
