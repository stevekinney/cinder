/**
 * Tests for the design-token literal-bypass matchers.
 *
 * This guard had no test file, and it shows: it shipped a hand-written literal
 * list that had gone stale against the corpus, and then a matcher that could
 * not see a multi-line declaration. Both classes reported a clean tree while
 * real bypasses sat in component CSS. Each case below pins one of those.
 */

import { describe, expect, test } from 'bun:test';

import {
  FONT_WEIGHT_LITERAL_PATTERN,
  TIMING_LITERAL_PATTERN,
  durationLiterals,
  fontWeightTokens,
} from './check-design-token-literals.ts';

describe('TIMING_LITERAL_PATTERN', () => {
  test('matches a single-line transition carrying a token duration', () => {
    expect(TIMING_LITERAL_PATTERN.test('  transition: opacity 200ms ease;')).toBe(true);
  });

  // The blind spot that let two real bypasses through: `.*?` under the `m` flag
  // stops at the first newline, so a formatted multi-value declaration hid its
  // durations entirely and the guard reported OK.
  test('matches a MULTILINE transition, not just a single-line one', () => {
    const declaration = [
      '    transition:',
      '      transform 200ms ease,',
      '      opacity 200ms ease;',
    ].join('\n');
    expect(TIMING_LITERAL_PATTERN.test(declaration)).toBe(true);
  });

  test('matches a multiline animation as well as a transition', () => {
    const declaration = ['  animation:', '    cinder-spin 750ms linear infinite;'].join('\n');
    expect(TIMING_LITERAL_PATTERN.test(declaration)).toBe(true);
  });

  // `[^;{}]` rather than `[\s\S]`: the match must stay inside one declaration so
  // an unterminated value cannot run on and flag a literal belonging to a later
  // rule, which would be a false positive in a different file's worth of CSS.
  test('does not run past the end of a declaration into a later rule', () => {
    const source = ['  transition: opacity ease;', '}', '.other {', '  padding: 200ms;'].join('\n');
    expect(TIMING_LITERAL_PATTERN.test(source)).toBe(false);
  });

  test('does not match a duration with no corresponding token', () => {
    // 150ms was hardcoded by the previous guard and has no token today, so
    // there is nothing to bypass.
    expect(durationLiterals()).not.toContain('150ms');
    expect(TIMING_LITERAL_PATTERN.test('  transition: opacity 150ms ease;')).toBe(false);
  });

  test('derives both the ms and s spellings of each duration', () => {
    const literals = durationLiterals();
    expect(literals).toContain('1.4s');
    expect(literals).toContain('1400ms');
  });
});

describe('FONT_WEIGHT_LITERAL_PATTERN', () => {
  test('matches every weight that has a token, not only 500 and 600', () => {
    for (const value of fontWeightTokens().keys()) {
      expect(FONT_WEIGHT_LITERAL_PATTERN.test(`  font-weight: ${value};`)).toBe(true);
    }
  });

  test('does not match a weight with no token', () => {
    expect(fontWeightTokens().has('550')).toBe(false);
    expect(FONT_WEIGHT_LITERAL_PATTERN.test('  font-weight: 550;')).toBe(false);
  });

  // The remediation advice is derived from this same map. Pairing them is what
  // stops the guard telling someone who wrote `400` to use `--cinder-font-medium`.
  test('pairs each weight with its own token rather than a fixed pair', () => {
    expect(fontWeightTokens().get('400')).toBe('--cinder-font-normal');
    expect(fontWeightTokens().get('700')).toBe('--cinder-font-bold');
  });
});
