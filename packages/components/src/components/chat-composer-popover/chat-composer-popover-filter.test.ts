import { describe, expect, test } from 'bun:test';

import { filterFuzzySubsequence, fuzzySubsequenceScore } from './chat-composer-popover-filter.ts';

describe('chat composer popover fuzzy filter', () => {
  test('scores subsequence matches and rejects missing characters', () => {
    expect(fuzzySubsequenceScore('New conversation', 'nw')).toBeGreaterThan(0);
    expect(fuzzySubsequenceScore('New conversation', 'zz')).toBeNull();
  });

  test('filters labels, values, and keywords without dependencies', () => {
    const items = [
      { value: 'help', label: 'Help' },
      { value: 'new', label: 'New conversation', keywords: ['fresh thread'] },
      { value: 'tools', label: 'Tools' },
    ];

    expect(filterFuzzySubsequence(items, 'fr')).toEqual([items[1]!]);
    expect(filterFuzzySubsequence(items, 'tl')).toEqual([items[2]!]);
    expect(filterFuzzySubsequence(items, '')).toEqual(items);
  });

  test('keeps long matching candidates even when the length penalty makes the score negative', () => {
    const items = [
      { value: 'short', label: 'Short' },
      { value: 'long', label: `${'x'.repeat(500)}a` },
    ];

    expect(fuzzySubsequenceScore(items[1]!.label, 'a')).toBeLessThan(0);
    expect(filterFuzzySubsequence(items, 'a')).toEqual([items[1]!]);
  });

  test('orders multiple matches by score and keeps input order for ties', () => {
    const items = [
      { value: 'open-search', label: 'Open search' },
      { value: 'open-settings', label: 'Open settings' },
      { value: 'send-message', label: 'Send message' },
      { value: 'alpha-one', label: 'Alpha one' },
      { value: 'alpha-two', label: 'Alpha two' },
    ];

    expect(filterFuzzySubsequence(items, 'open')).toEqual([items[0]!, items[1]!]);
    expect(filterFuzzySubsequence(items, 'se')).toEqual([items[2]!, items[0]!, items[1]!]);
    expect(filterFuzzySubsequence(items, 'al')).toEqual([items[3]!, items[4]!]);
  });
});
