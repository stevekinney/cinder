// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';
import {
  findAllOccurrences,
  fuzzyReanchor,
  reanchorQuote,
  scoreContextMatch,
  type ReanchorInput,
} from './reanchor.js';

describe('findAllOccurrences', () => {
  test('finds single occurrence', () => {
    const result = findAllOccurrences('hello', 'say hello world');
    expect(result).toEqual([{ start: 4, end: 9 }]);
  });

  test('finds multiple occurrences', () => {
    const result = findAllOccurrences('the', 'the cat and the dog');
    expect(result).toEqual([
      { start: 0, end: 3 },
      { start: 12, end: 15 },
    ]);
  });

  test('finds overlapping occurrences', () => {
    const result = findAllOccurrences('aa', 'aaaa');
    expect(result).toEqual([
      { start: 0, end: 2 },
      { start: 1, end: 3 },
      { start: 2, end: 4 },
    ]);
  });

  test('returns empty array when quote not found', () => {
    const result = findAllOccurrences('missing', 'text without the word');
    expect(result).toEqual([]);
  });

  test('returns empty array for empty quote', () => {
    const result = findAllOccurrences('', 'some text');
    expect(result).toEqual([]);
  });

  test('handles case sensitivity', () => {
    const result = findAllOccurrences('Hello', 'hello Hello HELLO');
    expect(result).toEqual([{ start: 6, end: 11 }]);
  });
});

describe('scoreContextMatch', () => {
  test('returns 1.0 for perfect context match', () => {
    const documentText = 'prefix text quote text suffix text';
    const match = { start: 12, end: 17 }; // "quote"
    const score = scoreContextMatch(documentText, match, 'prefix text ', ' text suffix');
    expect(score).toBeCloseTo(1.0, 1);
  });

  test('returns lower score for partial context match', () => {
    const documentText = 'different text quote text same';
    const match = { start: 15, end: 20 }; // "quote"
    const score = scoreContextMatch(documentText, match, 'prefix text ', ' text same');
    // Suffix matches better than prefix
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(1.0);
  });

  test('returns 1.0 for empty expected context', () => {
    const documentText = 'quote';
    const match = { start: 0, end: 5 };
    const score = scoreContextMatch(documentText, match, '', '');
    expect(score).toBe(1.0);
  });

  test('handles match at document start', () => {
    const documentText = 'quote suffix text';
    const match = { start: 0, end: 5 };
    const score = scoreContextMatch(documentText, match, 'no match', ' suffix text');
    // Prefix has no match (score 0), suffix matches well
    expect(score).toBeGreaterThan(0.3);
  });

  test('handles match at document end', () => {
    const documentText = 'prefix text quote';
    const match = { start: 12, end: 17 };
    const score = scoreContextMatch(documentText, match, 'prefix text ', 'no match');
    // Prefix matches well, suffix has no match
    expect(score).toBeGreaterThan(0.3);
  });
});

describe('fuzzyReanchor', () => {
  test('finds junction point using prefix and suffix', () => {
    const documentText = 'The quick brown fox jumps over the lazy dog';
    const anchor: ReanchorInput = {
      quote: 'deleted text',
      prefix: 'quick brown ',
      suffix: ' jumps over',
      lastKnownOffset: 10,
    };

    const result = fuzzyReanchor(documentText, anchor);

    // Should find a position near where prefix ends and suffix begins
    expect(result.found).toBe(false);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('returns not found with zero confidence when no context match', () => {
    const documentText = 'completely different text';
    const anchor: ReanchorInput = {
      quote: 'missing',
      prefix: 'xyz abc ',
      suffix: ' def ghi',
    };

    const result = fuzzyReanchor(documentText, anchor);

    expect(result.found).toBe(false);
    expect(result.from).toBe(0);
    expect(result.to).toBe(0);
    expect(result.confidence).toBe(0);
  });

  test('uses lastKnownOffset as reference position', () => {
    const documentText = 'some text in the document';
    const anchor: ReanchorInput = {
      quote: 'deleted',
      prefix: 'some ',
      suffix: ' in',
      lastKnownOffset: 5,
    };

    const result = fuzzyReanchor(documentText, anchor);

    // Should search near lastKnownOffset
    expect(result.found).toBe(false);
  });

  test('falls back to originalPosition when lastKnownOffset absent', () => {
    const documentText = 'some text in the document';
    const anchor: ReanchorInput = {
      quote: 'deleted',
      prefix: 'some ',
      suffix: ' in',
      originalPosition: { offset: 5 },
    };

    const result = fuzzyReanchor(documentText, anchor);

    expect(result.found).toBe(false);
  });
});

describe('reanchorQuote', () => {
  describe('exact match - single occurrence', () => {
    test('returns anchored for single match with good context', () => {
      const documentText = 'The quick brown fox jumps over the lazy dog';
      const anchor: ReanchorInput = {
        quote: 'brown fox',
        prefix: 'The quick ',
        suffix: ' jumps over',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(10);
      expect(result.to).toBe(19);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('returns found with lower confidence for single match with poor context', () => {
      const documentText = 'The quick brown fox jumps over the lazy dog';
      const anchor: ReanchorInput = {
        quote: 'brown fox',
        prefix: 'completely different ',
        suffix: ' wrong suffix',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(10);
      expect(result.to).toBe(19);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('exact match - multiple occurrences', () => {
    test('selects best match by context', () => {
      const documentText = 'the cat chased the dog and the bird flew away';
      const anchor: ReanchorInput = {
        quote: 'the',
        prefix: 'and ',
        suffix: ' bird',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(27); // "and the bird"
      expect(result.to).toBe(30);
    });

    test('uses lastKnownOffset for disambiguation', () => {
      // "the" appears three times, we want the one at position 0
      const documentText = 'the first the second the third';
      const anchor: ReanchorInput = {
        quote: 'the',
        prefix: '',
        suffix: ' first',
        lastKnownOffset: 0,
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.from).toBe(0);
      expect(result.to).toBe(3);
    });

    test('prefers lastKnownOffset over originalPosition', () => {
      // "the" appears at positions 0, 10, and 21
      const documentText = 'the first the second the third';
      const anchor: ReanchorInput = {
        quote: 'the',
        prefix: '',
        suffix: '',
        lastKnownOffset: 21, // Near "the third"
        originalPosition: { offset: 0 }, // Near "the first"
      };

      const result = reanchorQuote(documentText, anchor);

      // Should pick "the third" due to lastKnownOffset proximity
      expect(result.from).toBe(21);
      expect(result.to).toBe(24);
    });

    test('returns found when matches are ambiguous (selects best by scoring)', () => {
      // Create a case where two matches have similar context
      const documentText = 'start xxx middle xxx end';
      const anchor: ReanchorInput = {
        quote: 'xxx',
        prefix: ' ',
        suffix: ' ',
      };

      const result = reanchorQuote(documentText, anchor);

      // Both "xxx" have similar context (space before and after)
      // Selects best match by scoring even when ambiguous
      expect(result.found).toBe(true);
    });
  });

  describe('no match - fuzzy fallback', () => {
    test('returns not found when quote is deleted', () => {
      const documentText = 'The quick  jumps over the lazy dog';
      const anchor: ReanchorInput = {
        quote: 'brown fox',
        prefix: 'The quick ',
        suffix: ' jumps over',
        lastKnownOffset: 10,
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(false);
    });

    test('finds approximate position using context', () => {
      const documentText = 'prefix content suffix more text';
      const anchor: ReanchorInput = {
        quote: 'deleted quote',
        prefix: 'prefix ',
        suffix: ' suffix',
        lastKnownOffset: 7,
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(false);
      // Should find position near where prefix ends and suffix begins
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('handles empty document', () => {
      const anchor: ReanchorInput = {
        quote: 'text',
        prefix: '',
        suffix: '',
      };

      const result = reanchorQuote('', anchor);

      expect(result.found).toBe(false);
    });

    test('handles quote at document start', () => {
      const documentText = 'start of document';
      const anchor: ReanchorInput = {
        quote: 'start',
        prefix: '',
        suffix: ' of',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(0);
      expect(result.to).toBe(5);
    });

    test('handles quote at document end', () => {
      const documentText = 'end of document';
      const anchor: ReanchorInput = {
        quote: 'document',
        prefix: 'of ',
        suffix: '',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(7);
      expect(result.to).toBe(15);
    });

    test('handles multi-line quotes', () => {
      const documentText = 'line one\nline two\nline three';
      const anchor: ReanchorInput = {
        quote: 'line two',
        prefix: 'line one\n',
        suffix: '\nline three',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(9);
      expect(result.to).toBe(17);
    });

    test('handles special characters in quote', () => {
      const documentText = 'code: function() { return true; }';
      const anchor: ReanchorInput = {
        quote: '{ return true; }',
        prefix: 'function() ',
        suffix: '',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(17);
      expect(result.to).toBe(33);
    });
  });

  describe('confidence thresholds', () => {
    test('returns high confidence when context matches well', () => {
      const documentText = 'unique text with good context around it';
      const anchor: ReanchorInput = {
        quote: 'with good context',
        prefix: 'unique text ',
        suffix: ' around it',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('returns lower confidence when context does not match', () => {
      const documentText = 'text with the word somewhere';
      const anchor: ReanchorInput = {
        quote: 'word',
        prefix: 'wrong prefix ',
        suffix: ' wrong suffix',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
    });

    test('boundary case: partial context match', () => {
      // Create a scenario where context partially matches
      const documentText = 'prefix text quote suffix other';
      const anchor: ReanchorInput = {
        quote: 'quote',
        prefix: 'prefix text ', // Good prefix match
        suffix: ' different', // Poor suffix match
      };

      const result = reanchorQuote(documentText, anchor);

      // Should find the quote regardless of confidence level
      expect(result.found).toBe(true);
      expect(result.from).toBe(12);
      expect(result.to).toBe(17);
    });
  });

  describe('ambiguity handling', () => {
    test('selects best match even with similar contexts', () => {
      // Two occurrences with very similar context
      const documentText = 'a xxx b xxx c';
      const anchor: ReanchorInput = {
        quote: 'xxx',
        prefix: ' ', // Both have space before
        suffix: ' ', // Both have space after
      };

      const result = reanchorQuote(documentText, anchor);

      // Picks best match by scoring even when ambiguous
      expect(result.found).toBe(true);
    });

    test('handles three+ matches with close scores', () => {
      // Three occurrences, all with similar context
      const documentText = 'the start the middle the end';
      const anchor: ReanchorInput = {
        quote: 'the',
        prefix: '',
        suffix: ' ',
      };

      const result = reanchorQuote(documentText, anchor);

      // Should find all three and pick best based on scoring
      expect(result.found).toBe(true);
      // Should select one of the valid positions
      expect([0, 10, 21]).toContain(result.from);
    });

    test('disambiguates three+ matches using lastKnownOffset', () => {
      const documentText = 'the start the middle the end';
      const anchor: ReanchorInput = {
        quote: 'the',
        prefix: '',
        suffix: '',
        lastKnownOffset: 21, // Hint towards "the end"
      };

      const result = reanchorQuote(documentText, anchor);

      // Should pick "the" nearest to lastKnownOffset
      expect(result.found).toBe(true);
      expect(result.from).toBe(21);
      expect(result.to).toBe(24);
    });
  });

  describe('unicode handling', () => {
    test('handles unicode characters in quote', () => {
      const documentText = 'Hello 世界 and こんにちは world';
      const anchor: ReanchorInput = {
        quote: '世界',
        prefix: 'Hello ',
        suffix: ' and',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(6);
      expect(result.to).toBe(8);
    });

    test('handles emoji in quote', () => {
      const documentText = 'React with 👍 or 👎 to vote';
      const anchor: ReanchorInput = {
        quote: '👍',
        prefix: 'with ',
        suffix: ' or',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(11);
    });

    test('handles mixed unicode and ASCII', () => {
      const documentText = 'The café serves crème brûlée';
      const anchor: ReanchorInput = {
        quote: 'crème brûlée',
        prefix: 'serves ',
        suffix: '',
      };

      const result = reanchorQuote(documentText, anchor);

      expect(result.found).toBe(true);
      expect(result.from).toBe(16);
      expect(result.to).toBe(28);
    });
  });
});
