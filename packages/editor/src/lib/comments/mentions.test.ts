// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';
import { extractMentions } from './mentions.js';

describe('extractMentions', () => {
  test('extracts single mention', () => {
    const result = extractMentions('Hello @alice!');
    expect(result).toEqual(['alice']);
  });

  test('extracts multiple mentions', () => {
    const result = extractMentions('Hello @alice and @bob!');
    expect(result).toEqual(['alice', 'bob']);
  });

  test('deduplicates repeated mentions', () => {
    const result = extractMentions('@alice said to @bob, but @alice disagreed');
    expect(result).toEqual(['alice', 'bob']);
  });

  test('handles usernames with underscores', () => {
    const result = extractMentions('Thanks @user_name!');
    expect(result).toEqual(['user_name']);
  });

  test('handles usernames with hyphens', () => {
    const result = extractMentions('Thanks @user-name!');
    expect(result).toEqual(['user-name']);
  });

  test('handles mixed alphanumeric usernames', () => {
    const result = extractMentions('Thanks @user123!');
    expect(result).toEqual(['user123']);
  });

  test('ignores email addresses', () => {
    const result = extractMentions('Contact user@example.com or @alice');
    expect(result).toEqual(['alice']);
  });

  test('ignores mentions inside inline code', () => {
    const result = extractMentions('See `@config` or @alice');
    expect(result).toEqual(['alice']);
  });

  test('ignores mentions inside fenced code blocks', () => {
    const result = extractMentions(`Check this:
\`\`\`
const user = @admin;
\`\`\`
But @alice should see this.`);
    expect(result).toEqual(['alice']);
  });

  test('handles multiple inline code segments', () => {
    const result = extractMentions('Use `@hook1` and `@hook2` but ping @alice');
    expect(result).toEqual(['alice']);
  });

  test('returns empty array for no mentions', () => {
    const result = extractMentions('No mentions here');
    expect(result).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    const result = extractMentions('');
    expect(result).toEqual([]);
  });

  test('handles mention at start of string', () => {
    const result = extractMentions('@alice is here');
    expect(result).toEqual(['alice']);
  });

  test('handles mention at end of string', () => {
    const result = extractMentions('Hello @alice');
    expect(result).toEqual(['alice']);
  });

  test('handles only mention in string', () => {
    const result = extractMentions('@alice');
    expect(result).toEqual(['alice']);
  });

  test('ignores @ after word characters (prevents false positives)', () => {
    const result = extractMentions('Check the value@prop assignment');
    expect(result).toEqual([]);
  });

  test('ignores @ after periods (email pattern)', () => {
    const result = extractMentions('name.surname@domain and @alice');
    expect(result).toEqual(['alice']);
  });

  test('ignores @ after plus sign (email with tag pattern)', () => {
    const result = extractMentions('user+tag@example.com and @alice');
    expect(result).toEqual(['alice']);
  });

  test('handles newlines around mentions', () => {
    const result = extractMentions('Line 1\n@alice\nLine 3');
    expect(result).toEqual(['alice']);
  });

  test('handles multiple @ symbols in a row', () => {
    const result = extractMentions('@@alice is not valid but @bob is');
    // @alice is preceded by @, which is not a word char, so it should match
    expect(result).toContain('alice');
    expect(result).toContain('bob');
  });

  // Edge cases for unterminated/malformed markdown
  // Note: The regex uses non-greedy matching, so unterminated blocks don't
  // consume the entire string - they just fail to match and pass through.
  describe('edge cases (malformed markdown)', () => {
    test('extracts mentions from unterminated fenced code block (limitation)', () => {
      // Unterminated blocks don't match the regex, so content passes through
      // This is a known limitation - documenting actual behavior
      const result = extractMentions('```\n@inside\nno closing');
      expect(result).toContain('inside');
    });

    test('extracts mentions before and in unterminated fenced code block (limitation)', () => {
      const result = extractMentions('@alice then ```\n@inside code');
      // Both match since the unterminated block doesn't get stripped
      expect(result).toContain('alice');
      expect(result).toContain('inside');
    });

    test('handles adjacent inline code segments', () => {
      const result = extractMentions('`@a``@b` but @alice');
      // Adjacent backticks create two inline code segments
      expect(result).toEqual(['alice']);
    });

    test('handles inline code at string boundaries', () => {
      const result = extractMentions('`@start` middle @alice `@end`');
      expect(result).toEqual(['alice']);
    });
  });
});
