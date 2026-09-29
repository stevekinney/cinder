import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import PendingReviewRow from './pending-review-row.svelte';

const NOW = 1_700_000_000_000;

function entry(overrides: Partial<{ createdAt: number; timeout: number }> = {}) {
  return {
    status: 'pending' as const,
    reviewId: 'review-1',
    workflowId: 'wf_4a9f8c31e7b2d05a6f912c10',
    artifact: {},
    reviewType: 'Contract approval',
    reviewers: ['ops@example.com'],
    allowPartial: false,
    createdAt: NOW - 60_000,
    timeout: 600_000,
    ...overrides,
  };
}

describe('PendingReviewRow', () => {
  test('renders the review type, truncated workflow id, and countdown', async () => {
    const { getByText } = render(PendingReviewRow, {
      props: { entry: entry(), selected: false, now: NOW, onSelect: () => {} },
    });

    expect(getByText('Contract approval')).not.toBeNull();
    expect(getByText('wf_4a9f8…2c10')).not.toBeNull();
    expect(getByText('9m left')).not.toBeNull();
  });

  test('marks an urgent countdown (<20% remaining)', async () => {
    const urgent = entry({ createdAt: NOW - 550_000, timeout: 600_000 });
    const { getByText } = render(PendingReviewRow, {
      props: { entry: urgent, selected: false, now: NOW, onSelect: () => {} },
    });

    const countdown = getByText('50s left');
    expect(countdown.className).toContain('weft-review-row__countdown--urgent');
  });

  test('calls onSelect with the reviewId when clicked', async () => {
    const selected: string[] = [];
    const { getByRole } = render(PendingReviewRow, {
      props: { entry: entry(), selected: false, now: NOW, onSelect: (id) => selected.push(id) },
    });

    await fireEvent.click(getByRole('button'));
    expect(selected).toEqual(['review-1']);
  });

  test('reflects the selected state via aria-pressed', async () => {
    const { getByRole } = render(PendingReviewRow, {
      props: { entry: entry(), selected: true, now: NOW, onSelect: () => {} },
    });

    expect(getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
