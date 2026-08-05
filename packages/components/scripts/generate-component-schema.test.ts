import { describe, expect, test } from 'bun:test';

import { parseDefaultValue } from './generate-component-schema.ts';

describe('parseDefaultValue', () => {
  test('a single-quoted @default value resolves to the plain string, not the doubled-quote form', () => {
    expect(parseDefaultValue("'auto'")).toBe('auto');
  });

  test('a double-quoted @default value still resolves via JSON.parse (regression guard)', () => {
    expect(parseDefaultValue('"md"')).toBe('md');
  });

  test('a numeric @default value resolves to a number', () => {
    expect(parseDefaultValue('3')).toBe(3);
  });

  test('a single-quoted value with an internal unescaped quote is left untouched', () => {
    // The balanced-quote regex does not match (the inner `'` isn't
    // backslash-escaped), so this bails to the pre-fix raw-text fallback
    // rather than guessing at a stripped result that could corrupt the value.
    expect(parseDefaultValue("'won't fit'")).toBe("'won't fit'");
  });
});
