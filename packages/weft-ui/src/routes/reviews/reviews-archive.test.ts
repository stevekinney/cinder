/**
 * Component tests for `ReviewsArchive` (plan §9.5, Track D — Appendix B
 * "… / archive"). Supplies the query properties consumed by the view directly; network and
 * reactive query ownership are covered by the route integration tests.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { CompletedReviewEntry, ReviewListEntry } from '@lostgradient/weft';
import { HttpClientError } from '@lostgradient/weft';

import type { ReviewQuery } from './review-domain.ts';
import ReviewsArchive from './reviews-archive.svelte';

interface FakeQueryState<T> {
  data?: T;
  isPending: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => void;
}

function fakeQuery(state: FakeQueryState<ReviewListEntry[]>): ReviewQuery<ReviewListEntry[]> {
  return {
    data: state.data,
    isPending: state.isPending,
    isError: state.isError ?? false,
    error: state.error,
    refetch: state.refetch ?? (() => {}),
  };
}

const entry: CompletedReviewEntry = {
  status: 'completed',
  reviewId: 'review-1',
  workflowId: 'wf_aa129f0c1234567890abcdef',
  artifact: {},
  reviewType: 'Contract approval',
  reviewers: ['ops@example.com'],
  allowPartial: false,
  createdAt: Date.now() - 120_000,
  decision: 'approved',
  reviewer: 'Avery Diaz',
  timestamp: Date.now() - 30_000,
};

describe('ReviewsArchive', () => {
  test('shows a loading skeleton while pending', async () => {
    const { container } = render(ReviewsArchive, {
      props: { completedQuery: fakeQuery({ isPending: true }) },
    });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  test('shows a fault banner instead of a false empty state when the query errors', async () => {
    let refetched = false;
    const { getByText, queryByText, getByRole } = render(ReviewsArchive, {
      props: {
        completedQuery: fakeQuery({
          isPending: false,
          isError: true,
          error: new HttpClientError(401, 'authentication required'),
          refetch: () => {
            refetched = true;
          },
        }),
      },
    });

    expect(getByText('Not authorized')).not.toBeNull();
    expect(queryByText('No decisions yet')).toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(refetched).toBe(true);
  });

  test('shows an empty state with no completed reviews', async () => {
    const { getByText } = render(ReviewsArchive, {
      props: { completedQuery: fakeQuery({ data: [], isPending: false }) },
    });

    expect(getByText('No decisions yet')).not.toBeNull();
  });

  test('renders a row per completed review, read-only (no buttons)', async () => {
    const { getByText, queryAllByRole } = render(ReviewsArchive, {
      props: { completedQuery: fakeQuery({ data: [entry], isPending: false }) },
    });

    expect(getByText('Approved')).not.toBeNull();
    expect(getByText('Contract approval')).not.toBeNull();
    expect(getByText('Avery Diaz')).not.toBeNull();
    expect(getByText('wf_aa129…cdef')).not.toBeNull();
    expect(queryAllByRole('button')).toEqual([]);
  });
});
