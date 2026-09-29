import { describe, expect, test } from 'bun:test';

import { backtickFenceFor, literalFencedBlock } from './diff-review-export-fence.js';

describe('DiffReview export fence', () => {
  test('uses the minimum three-backtick fence for content with no backticks', () => {
    expect(backtickFenceFor('plain text')).toBe('```');
  });

  test('uses the minimum three-backtick fence for empty content', () => {
    expect(backtickFenceFor('')).toBe('```');
  });

  test('uses longest-run-plus-one when content already contains a three-backtick run', () => {
    expect(backtickFenceFor('```js\ncode\n```')).toBe('````');
  });

  test('uses longest-run-plus-one for a longer run than the fence itself', () => {
    expect(backtickFenceFor('``````')).toBe('```````');
  });

  test('considers every run in the content, not just the first', () => {
    expect(backtickFenceFor('``` then later `````` then ```')).toBe('```````');
  });

  test('literalFencedBlock wraps content with structural newlines, verbatim', () => {
    expect(literalFencedBlock('hello')).toBe('```\nhello\n```');
  });

  test('literalFencedBlock preserves a trailing newline in content as a literal blank line', () => {
    expect(literalFencedBlock('hello\n')).toBe('```\nhello\n\n```');
  });

  test('literalFencedBlock renders empty content as an empty line between the fences', () => {
    expect(literalFencedBlock('')).toBe('```\n\n```');
  });

  test('literalFencedBlock never trims leading whitespace', () => {
    expect(literalFencedBlock('  indented')).toBe('```\n  indented\n```');
  });
});
