import { describe, expect, test } from 'bun:test';

import type { PendingReviewEntry } from '@lostgradient/weft';

import {
  buildDiagnosticChips,
  buildReviewsNearTimeoutChip,
  isReviewNearTimeout,
  type TaskDiagnosticsSummary,
} from './critical-alerts.ts';

const ZERO_SUMMARY: TaskDiagnosticsSummary = {
  stuckQueued: 0,
  staleInflight: 0,
  retryStorms: 0,
  allWorkersAtCapacity: 0,
  deadLettered: 0,
  delayed: 0,
  unadoptedTerminal: 0,
};

function review(overrides: Partial<PendingReviewEntry> = {}): PendingReviewEntry {
  return {
    status: 'pending',
    reviewId: 'review-1',
    workflowId: 'wf-1',
    artifact: {},
    reviewType: 'content',
    reviewers: ['alice@example.com'],
    allowPartial: false,
    createdAt: 0,
    ...overrides,
  };
}

describe('buildDiagnosticChips', () => {
  test('returns no chips when every count is zero', () => {
    expect(buildDiagnosticChips(ZERO_SUMMARY)).toEqual([]);
  });

  test('returns one chip per non-zero kind, in severity order', () => {
    const chips = buildDiagnosticChips({
      ...ZERO_SUMMARY,
      stuckQueued: 12,
      deadLettered: 3,
      allWorkersAtCapacity: 1,
    });

    expect(chips.map((chip) => chip.id)).toEqual([
      'diagnostic:deadLettered',
      'diagnostic:stuckQueued',
      'diagnostic:allWorkersAtCapacity',
    ]);
  });

  test('dead-lettered chip is danger tone; the rest are warning', () => {
    const chips = buildDiagnosticChips({
      ...ZERO_SUMMARY,
      deadLettered: 1,
      staleInflight: 1,
      retryStorms: 1,
    });

    expect(chips.find((chip) => chip.id === 'diagnostic:deadLettered')?.tone).toBe('danger');
    expect(chips.find((chip) => chip.id === 'diagnostic:staleInflight')?.tone).toBe('warning');
    expect(chips.find((chip) => chip.id === 'diagnostic:retryStorms')?.tone).toBe('warning');
  });

  test('pluralizes the label for a count of exactly one', () => {
    const chips = buildDiagnosticChips({
      ...ZERO_SUMMARY,
      deadLettered: 1,
      delayed: 1,
      unadoptedTerminal: 1,
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      '1 dead-lettered task',
      '1 delayed task',
      '1 unadopted terminal result',
    ]);
  });

  test('each chip deep-links to /workers with a diagnostic query hint', () => {
    const chips = buildDiagnosticChips({ ...ZERO_SUMMARY, stuckQueued: 1 });
    expect(chips[0]?.href).toBe('/workers?diagnostic=stuckQueued');
  });
});

describe('isReviewNearTimeout', () => {
  test('is false when the review has no timeout configured', () => {
    expect(isReviewNearTimeout(review({ createdAt: 0 }), 1_000_000)).toBe(false);
  });

  test('is false with more than 20% of the window remaining', () => {
    const r = review({ createdAt: 0, timeout: 1_000_000 });
    expect(isReviewNearTimeout(r, 700_000)).toBe(false); // 30% remaining
  });

  test('is true with less than 20% of the window remaining', () => {
    const r = review({ createdAt: 0, timeout: 1_000_000 });
    expect(isReviewNearTimeout(r, 850_000)).toBe(true); // 15% remaining
  });

  test('is true once the deadline has already passed', () => {
    const r = review({ createdAt: 0, timeout: 1_000_000 });
    expect(isReviewNearTimeout(r, 1_500_000)).toBe(true);
  });
});

describe('buildReviewsNearTimeoutChip', () => {
  test('returns null when no reviews qualify', () => {
    const reviews = [review({ createdAt: 0, timeout: 1_000_000 })];
    expect(buildReviewsNearTimeoutChip(reviews, 0)).toBeNull();
  });

  test('counts only qualifying reviews and pluralizes the label', () => {
    const reviews = [
      review({ reviewId: 'a', createdAt: 0, timeout: 1_000_000 }), // near timeout at now=900_000
      review({ reviewId: 'b', createdAt: 0, timeout: 1_000_000 }), // near timeout at now=900_000
      review({ reviewId: 'c', createdAt: 900_000, timeout: 1_000_000 }), // fresh, not near timeout
    ];

    const chip = buildReviewsNearTimeoutChip(reviews, 900_000);
    expect(chip).not.toBeNull();
    expect(chip?.label).toBe('2 reviews near timeout');
    expect(chip?.href).toBe('/reviews');
  });

  test('singular label for exactly one qualifying review', () => {
    const reviews = [review({ createdAt: 0, timeout: 1_000_000 })];
    const chip = buildReviewsNearTimeoutChip(reviews, 900_000);
    expect(chip?.label).toBe('1 review near timeout');
  });
});
