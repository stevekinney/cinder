import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import CompletedReviewRow from './completed-review-row.svelte';

const NOW = 1_700_000_000_000;

function entry(decision: 'approved' | 'rejected' | 'needs-changes') {
  return {
    status: 'completed' as const,
    reviewId: 'review-1',
    workflowId: 'wf_aa129f0c1234567890abcdef',
    artifact: {},
    reviewType: 'Contract approval',
    reviewers: ['ops@example.com'],
    allowPartial: false,
    createdAt: NOW - 120_000,
    decision,
    reviewer: 'Avery Diaz',
    timestamp: NOW - 60_000,
  };
}

describe('CompletedReviewRow', () => {
  test('renders an approved decision', async () => {
    const { getByText } = render(CompletedReviewRow, {
      props: { entry: entry('approved'), selected: false, now: NOW, onSelect: () => {} },
    });

    expect(getByText('Approved')).not.toBeNull();
    expect(getByText('Avery Diaz')).not.toBeNull();
  });

  test('renders a rejected decision', async () => {
    const { getByText } = render(CompletedReviewRow, {
      props: { entry: entry('rejected'), selected: false, now: NOW, onSelect: () => {} },
    });

    expect(getByText('Rejected')).not.toBeNull();
  });

  test('renders a needs-changes decision', async () => {
    const { getByText } = render(CompletedReviewRow, {
      props: { entry: entry('needs-changes'), selected: false, now: NOW, onSelect: () => {} },
    });

    expect(getByText('Needs changes')).not.toBeNull();
  });

  test('calls onSelect with the reviewId when clicked', async () => {
    const selected: string[] = [];
    const { getByRole } = render(CompletedReviewRow, {
      props: {
        entry: entry('approved'),
        selected: false,
        now: NOW,
        onSelect: (id) => selected.push(id),
      },
    });

    await fireEvent.click(getByRole('button'));
    expect(selected).toEqual(['review-1']);
  });
});
