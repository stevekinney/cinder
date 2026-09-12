import { describe, expect, test } from 'bun:test';

import { formatHex, gradientFromKeyboard } from './color-picker.utilities.ts';

describe('formatHex', () => {
  test('formats an opaque color as a 6-digit hex string', () => {
    expect(formatHex(0, 100, 50, 1, false)).toBe('#ff0000');
  });

  test('appends a quantized alpha byte when withAlpha is true', () => {
    expect(formatHex(0, 100, 50, 0.5, true)).toBe('#ff000080');
  });
});

describe('gradientFromKeyboard', () => {
  const current = { h: 0, s: 50, l: 50, a: 1 };

  test('returns null for a key that does not move saturation or lightness', () => {
    expect(gradientFromKeyboard(current, 'Enter', false)).toBeNull();
  });
});
