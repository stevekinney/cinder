/**
 * Front matter parsing and serialization tests.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 */

import { describe, expect, test } from 'bun:test';
import {
  extractFrontMatter,
  hasFrontMatter,
  mergeFrontMatter,
  parseFrontMatter,
  validateFrontMatter,
} from './index';

describe('extractFrontMatter', () => {
  test('returns tuple of data, raw, and body', () => {
    const markdown = `---
title: Test
---

Body`;

    const [data, raw, body] = extractFrontMatter(markdown);

    expect(data).toEqual({ title: 'Test' });
    expect(raw).toBe('title: Test');
    expect(body).toBe('\nBody');
  });
});

describe('hasFrontMatter', () => {
  test('returns true when front matter exists', () => {
    expect(hasFrontMatter('---\ntitle: Test\n---\nBody')).toBe(true);
  });

  test('returns false when no front matter', () => {
    expect(hasFrontMatter('# Just content')).toBe(false);
  });

  test('returns false when whitespace before delimiter (consistent with parseFrontMatter)', () => {
    // Leading whitespace means no front matter - this must be consistent with parseFrontMatter()
    // which also requires front matter to start at position 0
    expect(hasFrontMatter('  ---\ntitle: Test\n---')).toBe(false);
  });

  test('stays consistent with parseFrontMatter for a false-positive span (cinder#1325)', () => {
    // Before delegating to parseFrontMatter, this was a bare
    // `markdown.startsWith('---')`, so it said `true` here even after
    // parseFrontMatter() itself was fixed to say `false` -- directly
    // contradicting this function's own "mirrors parseFrontMatter" contract
    // for exactly the input the cinder#1325 fix targets.
    const markdown = '---\n- one\n- two\n---\n\nBody.';

    expect(hasFrontMatter(markdown)).toBe(parseFrontMatter(markdown).hasFrontMatter);
    expect(hasFrontMatter(markdown)).toBe(false);
  });
});

describe('validateFrontMatter', () => {
  test('validates correct YAML', () => {
    const result = validateFrontMatter('title: Hello\ndate: 2025-01-04');

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('validates empty string', () => {
    const result = validateFrontMatter('');

    expect(result.valid).toBe(true);
  });

  test('detects invalid YAML', () => {
    const result = validateFrontMatter('title: [\ninvalid');

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('mergeFrontMatter', () => {
  test('merges new values', () => {
    const existing = { title: 'Old', author: 'Jane' };
    const updates = { title: 'New', draft: true };

    const result = mergeFrontMatter(existing, updates);

    expect(result).toEqual({
      title: 'New',
      author: 'Jane',
      draft: true,
    });
  });

  test('removes keys with undefined values', () => {
    const existing = { title: 'Keep', remove: 'This' };
    const updates = { remove: undefined };

    const result = mergeFrontMatter(existing, updates);

    expect(result).toEqual({ title: 'Keep' });
    expect('remove' in result).toBe(false);
  });

  test('handles null existing data', () => {
    const result = mergeFrontMatter(null, { title: 'New' });

    expect(result).toEqual({ title: 'New' });
  });
});
