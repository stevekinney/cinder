import { describe, expect, test } from 'bun:test';

import type { CompletedReviewEntry } from '@lostgradient/weft';

import {
  classifyArtifactValue,
  completedEntriesOnly,
  extractReviewMetadataEntries,
  extractReviewSections,
  formatReviewCountdown,
  humanizeKey,
  humanizeKeys,
  isReviewFleetEventKind,
  isReviewTimedOut,
  partitionPendingReviews,
  pendingEntriesOnly,
  reviewDeadline,
  suggestOverallDecision,
} from './review-domain.ts';

const NOW = 1_700_000_000_000;

function pendingEntry(overrides: Partial<{ createdAt: number; timeout: number }> = {}) {
  return {
    status: 'pending' as const,
    reviewId: 'review-1',
    workflowId: 'wf-1',
    artifact: {},
    reviewType: 'content',
    reviewers: ['ops@example.com'],
    allowPartial: false,
    createdAt: NOW - 60_000,
    timeout: 600_000,
    ...overrides,
  };
}

describe('reviewDeadline', () => {
  test('reports no deadline when timeout is undefined', () => {
    const deadline = reviewDeadline({ createdAt: NOW }, NOW);
    expect(deadline).toEqual({
      hasDeadline: false,
      remainingMs: Number.POSITIVE_INFINITY,
      isTimedOut: false,
      isUrgent: false,
    });
  });

  test('is not urgent with plenty of time remaining', () => {
    const deadline = reviewDeadline({ createdAt: NOW, timeout: 1_000_000 }, NOW);
    expect(deadline.isTimedOut).toBe(false);
    expect(deadline.isUrgent).toBe(false);
    expect(deadline.remainingMs).toBe(1_000_000);
  });

  test('is urgent under 20% of the window remaining', () => {
    // Window is 1_000_000ms; 150_000ms remaining is 15% — under the 20% cutoff.
    const deadline = reviewDeadline({ createdAt: NOW - 850_000, timeout: 1_000_000 }, NOW);
    expect(deadline.isTimedOut).toBe(false);
    expect(deadline.isUrgent).toBe(true);
  });

  test('is exactly at the 20% boundary — not yet urgent (urgent is <= but boundary itself still counts as urgent per spec, verify inclusive)', () => {
    // 200_000ms remaining out of a 1_000_000ms window is exactly 20%.
    const deadline = reviewDeadline({ createdAt: NOW - 800_000, timeout: 1_000_000 }, NOW);
    expect(deadline.isUrgent).toBe(true);
    expect(deadline.isTimedOut).toBe(false);
  });

  test('is timed out once the deadline has elapsed', () => {
    const deadline = reviewDeadline({ createdAt: NOW - 700_000, timeout: 600_000 }, NOW);
    expect(deadline.isTimedOut).toBe(true);
    expect(deadline.isUrgent).toBe(false);
    expect(deadline.remainingMs).toBeLessThan(0);
  });

  test('treats the exact deadline instant as timed out (remainingMs === 0)', () => {
    const deadline = reviewDeadline({ createdAt: NOW - 600_000, timeout: 600_000 }, NOW);
    expect(deadline.remainingMs).toBe(0);
    expect(deadline.isTimedOut).toBe(true);
  });
});

describe('isReviewTimedOut', () => {
  test('mirrors reviewDeadline().isTimedOut', () => {
    expect(isReviewTimedOut({ createdAt: NOW - 700_000, timeout: 600_000 }, NOW)).toBe(true);
    expect(isReviewTimedOut({ createdAt: NOW, timeout: 600_000 }, NOW)).toBe(false);
  });
});

describe('formatReviewCountdown', () => {
  test('labels an unbounded review', () => {
    expect(formatReviewCountdown(reviewDeadline({ createdAt: NOW }, NOW))).toBe('No deadline');
  });

  test('labels a timed-out review', () => {
    expect(
      formatReviewCountdown(reviewDeadline({ createdAt: NOW - 700_000, timeout: 600_000 }, NOW)),
    ).toBe('Timed out');
  });

  test('labels remaining time with the "left" suffix', () => {
    expect(
      formatReviewCountdown(reviewDeadline({ createdAt: NOW, timeout: 18 * 60_000 }, NOW)),
    ).toBe('18m left');
  });
});

describe('partitionPendingReviews', () => {
  test('splits pending vs. already-timed-out entries', () => {
    const fresh = pendingEntry();
    const stale = pendingEntry({ createdAt: NOW - 700_000, timeout: 600_000 });
    const { pending, timedOut } = partitionPendingReviews(
      [
        { ...fresh, reviewId: 'fresh' },
        { ...stale, reviewId: 'stale' },
      ],
      NOW,
    );
    expect(pending.map((entry) => entry.reviewId)).toEqual(['fresh']);
    expect(timedOut.map((entry) => entry.reviewId)).toEqual(['stale']);
  });

  test('returns empty buckets for an empty list', () => {
    expect(partitionPendingReviews([], NOW)).toEqual({ pending: [], timedOut: [] });
  });
});

describe('extractReviewSections', () => {
  test('extracts a non-empty sections object', () => {
    const sections = extractReviewSections({
      documentTitle: 'Q3 copy',
      sections: { headline: 'Ship it', body: 'Details' },
    });
    expect(sections).toEqual({ headline: 'Ship it', body: 'Details' });
  });

  test('returns null when artifact has no sections field', () => {
    expect(extractReviewSections({ text: 'plain artifact' })).toBeNull();
  });

  test('returns null when sections is empty', () => {
    expect(extractReviewSections({ sections: {} })).toBeNull();
  });

  test('returns null when sections is not a plain object', () => {
    expect(extractReviewSections({ sections: ['a', 'b'] })).toBeNull();
  });

  test('returns null for a bare string artifact', () => {
    expect(extractReviewSections('just text')).toBeNull();
  });

  test('returns null for a null/array artifact', () => {
    expect(extractReviewSections(null)).toBeNull();
    expect(extractReviewSections([1, 2, 3])).toBeNull();
  });
});

describe('extractReviewMetadataEntries', () => {
  test('excludes the sections key and preserves the rest', () => {
    const entries = extractReviewMetadataEntries({
      documentTitle: 'Q3 copy',
      sections: { headline: 'x' },
    });
    expect(entries).toEqual([['documentTitle', 'Q3 copy']]);
  });

  test('returns an empty array for non-object artifacts', () => {
    expect(extractReviewMetadataEntries('text')).toEqual([]);
  });
});

describe('suggestOverallDecision', () => {
  test('returns null with no section decisions yet', () => {
    expect(suggestOverallDecision(new Map())).toBeNull();
  });

  test('suggests approved when every section is approved', () => {
    const decisions = new Map([
      ['headline', 'approved' as const],
      ['body', 'approved' as const],
    ]);
    expect(suggestOverallDecision(decisions)).toBe('approved');
  });

  test('suggests needs-changes when any section is rejected', () => {
    const decisions = new Map([
      ['headline', 'approved' as const],
      ['body', 'rejected' as const],
    ]);
    expect(suggestOverallDecision(decisions)).toBe('needs-changes');
  });

  test('suggests needs-changes when every section is rejected', () => {
    const decisions = new Map([['headline', 'rejected' as const]]);
    expect(suggestOverallDecision(decisions)).toBe('needs-changes');
  });
});

describe('classifyArtifactValue', () => {
  test('a bare string is text', () => {
    expect(classifyArtifactValue('hello')).toEqual({ kind: 'text', text: 'hello' });
  });

  test('an object with a markdown key renders as markdown', () => {
    expect(classifyArtifactValue({ markdown: '# Title' })).toEqual({
      kind: 'markdown',
      markdown: '# Title',
    });
  });

  test('an object with an imageUrl key renders as an image', () => {
    expect(classifyArtifactValue({ imageUrl: 'https://example.com/a.png' })).toEqual({
      kind: 'image',
      imageUrl: 'https://example.com/a.png',
    });
  });

  test('an object with an htmlContent key renders as sandboxed html', () => {
    expect(classifyArtifactValue({ htmlContent: '<p>hi</p>' })).toEqual({
      kind: 'html',
      html: '<p>hi</p>',
    });
  });

  test('markdown takes precedence over imageUrl/htmlContent when multiple keys are present', () => {
    expect(
      classifyArtifactValue({ markdown: '# A', imageUrl: 'https://x', htmlContent: '<p>x</p>' }),
    ).toEqual({ kind: 'markdown', markdown: '# A' });
  });

  test('a plain object with none of the recognized keys falls back to the inspector', () => {
    const value = { amount: 248_000, currency: 'USD' };
    expect(classifyArtifactValue(value)).toEqual({ kind: 'inspector', value });
  });

  test('an array falls back to the inspector', () => {
    expect(classifyArtifactValue([1, 2, 3])).toEqual({ kind: 'inspector', value: [1, 2, 3] });
  });

  test('a number/boolean/null falls back to the inspector', () => {
    expect(classifyArtifactValue(42)).toEqual({ kind: 'inspector', value: 42 });
    expect(classifyArtifactValue(null)).toEqual({ kind: 'inspector', value: null });
  });

  test('a non-string markdown/imageUrl/htmlContent value is ignored (falls through to inspector)', () => {
    expect(classifyArtifactValue({ markdown: 42 })).toEqual({
      kind: 'inspector',
      value: { markdown: 42 },
    });
  });
});

describe('humanizeKey', () => {
  test('splits camelCase', () => {
    expect(humanizeKey('callToAction')).toBe('Call to action');
  });

  test('splits snake_case', () => {
    expect(humanizeKey('annual_value')).toBe('Annual value');
  });

  test('splits kebab-case', () => {
    expect(humanizeKey('discount-rate')).toBe('Discount rate');
  });

  test('leaves a single lowercase word capitalized', () => {
    expect(humanizeKey('term')).toBe('Term');
  });

  test('returns the original key for an empty string', () => {
    expect(humanizeKey('')).toBe('');
  });
});

describe('humanizeKeys', () => {
  test('maps every top-level key and preserves values', () => {
    expect(humanizeKeys({ callToAction: 'Buy now', term: '24 months' })).toEqual({
      'Call to action': 'Buy now',
      Term: '24 months',
    });
  });

  test('returns an empty object for an empty input', () => {
    expect(humanizeKeys({})).toEqual({});
  });
});

describe('pendingEntriesOnly / completedEntriesOnly', () => {
  const pending = { ...pendingEntry(), reviewId: 'p1' };
  const completed: CompletedReviewEntry = {
    status: 'completed',
    reviewId: 'c1',
    workflowId: 'wf-1',
    artifact: {},
    reviewType: 'content',
    reviewers: ['ops@example.com'],
    allowPartial: false,
    createdAt: NOW,
    decision: 'approved',
    reviewer: 'ops@example.com',
    timestamp: NOW,
  };

  test('pendingEntriesOnly keeps only pending entries', () => {
    expect(pendingEntriesOnly([pending, completed]).map((entry) => entry.reviewId)).toEqual(['p1']);
  });

  test('completedEntriesOnly keeps only completed entries', () => {
    expect(completedEntriesOnly([pending, completed]).map((entry) => entry.reviewId)).toEqual([
      'c1',
    ]);
  });

  test('both return an empty array for an empty list', () => {
    expect(pendingEntriesOnly([])).toEqual([]);
    expect(completedEntriesOnly([])).toEqual([]);
  });
});

describe('isReviewFleetEventKind', () => {
  test('recognizes both review fleet-event kinds', () => {
    expect(isReviewFleetEventKind('human-review:requested')).toBe(true);
    expect(isReviewFleetEventKind('human-review:completed')).toBe(true);
  });

  test('rejects unrelated kinds', () => {
    expect(isReviewFleetEventKind('workflow:completed')).toBe(false);
    expect(isReviewFleetEventKind('alert:fired')).toBe(false);
  });
});
