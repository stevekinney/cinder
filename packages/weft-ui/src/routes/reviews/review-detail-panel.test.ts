/**
 * Component tests for `ReviewDetailPanel` (plan §9.5, Track D). Covers
 * the pending, timeout-expired, and completed treatments named in plan
 * Appendix B ("Review inbox + decision (partial sections) / completed /
 * timeout-expired / archive").
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ReviewDetailPanel from './review-detail-panel.svelte';

const NOW = 1_700_000_000_000;

const pendingSectioned = {
  status: 'pending' as const,
  reviewId: 'review-1',
  workflowId: 'wf-1',
  artifact: {
    documentTitle: 'Q3 landing page copy',
    sections: { headline: 'Ship it', body: 'Details here' },
  },
  reviewType: 'content',
  reviewers: ['ops@example.com'],
  allowPartial: true,
  createdAt: NOW - 60_000,
  timeout: 600_000,
};

const pendingTimedOut = {
  ...pendingSectioned,
  reviewId: 'review-2',
  createdAt: NOW - 700_000,
  timeout: 600_000,
};

const pendingUnsectioned = {
  status: 'pending' as const,
  reviewId: 'review-3',
  workflowId: 'wf-3',
  artifact: 'Plain text artifact needing review.',
  reviewType: 'general',
  reviewers: ['ops@example.com'],
  allowPartial: false,
  createdAt: NOW - 60_000,
};

const completed = {
  status: 'completed' as const,
  reviewId: 'review-4',
  workflowId: 'wf-4',
  artifact: { sections: { headline: 'Ship it', body: 'Details' } },
  reviewType: 'content',
  reviewers: ['ops@example.com'],
  allowPartial: true,
  createdAt: NOW - 120_000,
  decision: 'needs-changes' as const,
  reviewer: 'Avery Diaz',
  feedback: 'Tighten the CTA.',
  sectionDecisions: { headline: 'approved' as const, body: 'rejected' as const },
  timestamp: NOW - 30_000,
};

describe('ReviewDetailPanel', () => {
  test('renders sections with a decision form for a pending sectioned review', async () => {
    const { getByText, getByRole, container } = render(ReviewDetailPanel, {
      props: { entry: pendingSectioned, now: NOW, submitting: false, onSubmit: () => {} },
    });

    // "Headline" appears twice by design: once as the artifact section
    // heading (content region) and once as the decision-form row label
    // (decision region) — assert the heading specifically.
    const headings = [...container.querySelectorAll('h3')].map((node) => node.textContent);
    expect(headings).toContain('Headline');
    expect(getByText('Ship it')).not.toBeNull();
    expect(getByText('Q3 landing page copy')).not.toBeNull();
    expect(getByRole('button', { name: 'Submit decision' })).not.toBeNull();
  });

  test('withholds the decision form and shows the timeout banner once the deadline elapses', async () => {
    const { getByText, queryByRole } = render(ReviewDetailPanel, {
      props: { entry: pendingTimedOut, now: NOW, submitting: false, onSubmit: () => {} },
    });

    expect(getByText(/timeout has passed/)).not.toBeNull();
    expect(queryByRole('button', { name: 'Submit decision' })).toBeNull();
  });

  test('renders an unsectioned artifact as a single block with a decision form', async () => {
    const { getByText, getByRole } = render(ReviewDetailPanel, {
      props: { entry: pendingUnsectioned, now: NOW, submitting: false, onSubmit: () => {} },
    });

    expect(getByText('Plain text artifact needing review.')).not.toBeNull();
    expect(getByRole('button', { name: 'Submit decision' })).not.toBeNull();
  });

  test('renders a read-only recorded decision for a completed review, with no form', async () => {
    const { getByText, queryByRole } = render(ReviewDetailPanel, {
      props: { entry: completed, now: NOW, submitting: false, onSubmit: () => {} },
    });

    expect(getByText(/Decided by Avery Diaz/)).not.toBeNull();
    expect(getByText('Tighten the CTA.')).not.toBeNull();
    expect(getByText(/Headline: Approved/)).not.toBeNull();
    expect(getByText(/Body: Rejected/)).not.toBeNull();
    expect(queryByRole('button', { name: 'Submit decision' })).toBeNull();
  });

  test('calls onSubmit with the reviewId and the decision-form submission', async () => {
    const submissions: unknown[] = [];
    const { getByRole, getByLabelText } = render(ReviewDetailPanel, {
      props: {
        entry: pendingUnsectioned,
        now: NOW,
        submitting: false,
        onSubmit: (reviewId, submission) => submissions.push({ reviewId, submission }),
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Approve' }));
    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });
    await fireEvent.click(getByRole('button', { name: 'Submit decision' }));

    expect(submissions).toEqual([
      {
        reviewId: 'review-3',
        submission: { decision: 'approved', reviewer: 'ops@example.com' },
      },
    ]);
  });
});
