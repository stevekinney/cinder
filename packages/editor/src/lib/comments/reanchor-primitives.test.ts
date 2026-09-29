import { describe, expect, test } from 'bun:test';
import {
  findAllOccurrences,
  fuzzyReanchor,
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
