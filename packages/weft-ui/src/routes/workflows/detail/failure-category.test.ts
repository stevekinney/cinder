import { describe, expect, test } from 'bun:test';

import type { FailureCategory } from '@lostgradient/weft';

import { failureCategoryExplanation, failureCategoryLabel } from './failure-category.ts';

const ALL_CATEGORIES: readonly FailureCategory[] = [
  'application',
  'timeout',
  'cancellation',
  'resource',
  'system',
];

describe('failureCategoryExplanation', () => {
  test('every taxonomy category has a non-empty explanation', () => {
    for (const category of ALL_CATEGORIES) {
      expect(failureCategoryExplanation(category).length).toBeGreaterThan(0);
    }
  });

  test('null (uncategorized failure) has its own explanation', () => {
    expect(failureCategoryExplanation(null)).toBe('This failure could not be classified.');
  });

  test('undefined (never failed) returns empty string', () => {
    expect(failureCategoryExplanation(undefined)).toBe('');
  });

  test('explanations are distinct per category', () => {
    const explanations = new Set(
      ALL_CATEGORIES.map((category) => failureCategoryExplanation(category)),
    );
    expect(explanations.size).toBe(ALL_CATEGORIES.length);
  });
});

describe('failureCategoryLabel', () => {
  test('labels every real category verbatim', () => {
    for (const category of ALL_CATEGORIES) {
      expect(failureCategoryLabel(category)).toBe(category);
    }
  });

  test('null renders as "uncategorized"', () => {
    expect(failureCategoryLabel(null)).toBe('uncategorized');
  });

  test('undefined renders as empty string', () => {
    expect(failureCategoryLabel(undefined)).toBe('');
  });
});
