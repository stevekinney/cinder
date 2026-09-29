import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `ReviewDecisionForm` (plan §9.5, Track D — the
 * AT-critical review surface). `bun test` + happy-dom +
 * `@testing-library/svelte`, run via `bun run test`.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ReviewDecisionForm, { type ReviewDecisionSubmission } from './review-decision-form.svelte';

describe('ReviewDecisionForm — unsectioned', () => {
  test('submit is disabled until an overall decision and reviewer are provided', async () => {
    const submissions: ReviewDecisionSubmission[] = [];
    const { getByRole, getByLabelText } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r1',
        sectionKeys: [],
        submitting: false,
        onSubmit: (submission) => submissions.push(submission),
      },
    });

    const submit = requireElement(
      getByRole('button', { name: 'Submit decision' }),
      HTMLButtonElement,
    );
    expect(submit.disabled).toBe(true);

    await fireEvent.click(getByRole('radio', { name: 'Approve' }));
    expect(submit.disabled).toBe(true);

    const reviewerField = requireElement(getByLabelText(/^Reviewer/), HTMLInputElement);
    await fireEvent.input(reviewerField, { target: { value: 'ops@example.com' } });
    expect(submit.disabled).toBe(false);
  });

  test('approve submits without requiring feedback', async () => {
    const submissions: ReviewDecisionSubmission[] = [];
    const { getByRole, getByLabelText } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r1',
        sectionKeys: [],
        submitting: false,
        onSubmit: (submission) => submissions.push(submission),
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Approve' }));
    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });
    await fireEvent.click(getByRole('button', { name: 'Submit decision' }));

    expect(submissions).toEqual([{ decision: 'approved', reviewer: 'ops@example.com' }]);
  });

  test('reject requires feedback before submit is enabled', async () => {
    const submissions: ReviewDecisionSubmission[] = [];
    const { getByRole, getByLabelText } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r1',
        sectionKeys: [],
        submitting: false,
        onSubmit: (submission) => submissions.push(submission),
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Reject' }));
    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });
    const submit = requireElement(
      getByRole('button', { name: 'Submit decision' }),
      HTMLButtonElement,
    );
    expect(submit.disabled).toBe(true);

    await fireEvent.input(getByLabelText(/^Feedback/), {
      target: { value: 'Not acceptable.' },
    });
    expect(submit.disabled).toBe(false);

    await fireEvent.click(submit);
    expect(submissions).toEqual([
      { decision: 'rejected', reviewer: 'ops@example.com', feedback: 'Not acceptable.' },
    ]);
  });

  test('disables the submit button while submitting', async () => {
    const { getByRole, getByLabelText } = render(ReviewDecisionForm, {
      props: { reviewId: 'r1', sectionKeys: [], submitting: true, onSubmit: () => {} },
    });

    await fireEvent.click(getByRole('radio', { name: 'Approve' }));
    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });

    expect(
      requireElement(getByRole('button', { name: 'Submitting…' }), HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('ReviewDecisionForm — sectioned (allowPartial)', () => {
  test('suggests the overall decision from section decisions until manually touched', async () => {
    const { getAllByRole, getByText } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r2',
        sectionKeys: ['headline', 'body'],
        submitting: false,
        onSubmit: () => {},
      },
    });

    const [headlineApprove] = getAllByRole('radio', { name: 'Approve' });
    await fireEvent.click(headlineApprove!);
    const [, bodyApprove] = getAllByRole('radio', { name: 'Approve' });
    await fireEvent.click(bodyApprove!);

    expect(getByText('Suggested from sections')).not.toBeNull();
    const overallApprove = getAllByRole('radio', { name: 'Approve' }).at(-1);
    expect(overallApprove?.getAttribute('aria-checked')).toBe('true');
  });

  test('suggests needs-changes when any section is rejected', async () => {
    const { getAllByRole, getByText } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r3',
        sectionKeys: ['headline', 'body'],
        submitting: false,
        onSubmit: () => {},
      },
    });

    const [headlineReject] = getAllByRole('radio', { name: 'Reject' });
    await fireEvent.click(headlineReject!);

    expect(getByText('Suggested from sections')).not.toBeNull();
    const overallChanges = getAllByRole('radio', { name: 'Changes' }).at(-1);
    expect(overallChanges?.getAttribute('aria-checked')).toBe('true');
  });

  test('a manual overall pick stops the auto-suggestion from overriding it', async () => {
    const { getAllByRole } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r4',
        sectionKeys: ['headline'],
        submitting: false,
        onSubmit: () => {},
      },
    });

    const overallReject = getAllByRole('radio', { name: 'Reject' }).at(-1);
    await fireEvent.click(overallReject!);

    const [headlineApprove] = getAllByRole('radio', { name: 'Approve' });
    await fireEvent.click(headlineApprove!);

    expect(overallReject?.getAttribute('aria-checked')).toBe('true');
  });

  test('submits per-section decisions alongside the overall decision', async () => {
    const submissions: ReviewDecisionSubmission[] = [];
    const { getAllByRole, getByLabelText, getByRole } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r5',
        sectionKeys: ['headline', 'body'],
        submitting: false,
        onSubmit: (submission) => submissions.push(submission),
      },
    });

    const [headlineApprove] = getAllByRole('radio', { name: 'Approve' });
    await fireEvent.click(headlineApprove!);
    const [headlineReject, bodyReject] = getAllByRole('radio', { name: 'Reject' });
    void headlineReject;
    await fireEvent.click(bodyReject!);

    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });
    await fireEvent.input(getByLabelText(/^Feedback/), {
      target: { value: 'Tighten the CTA.' },
    });
    await fireEvent.click(getByRole('button', { name: 'Submit decision' }));

    expect(submissions).toEqual([
      {
        decision: 'needs-changes',
        reviewer: 'ops@example.com',
        feedback: 'Tighten the CTA.',
        sectionDecisions: { headline: 'approved', body: 'rejected' },
      },
    ]);
  });

  test('does not require every section to be decided before submitting', async () => {
    const submissions: ReviewDecisionSubmission[] = [];
    const { getAllByRole, getByLabelText, getByRole } = render(ReviewDecisionForm, {
      props: {
        reviewId: 'r6',
        sectionKeys: ['headline', 'body'],
        submitting: false,
        onSubmit: (submission) => submissions.push(submission),
      },
    });

    const overallApprove = getAllByRole('radio', { name: 'Approve' }).at(-1);
    await fireEvent.click(overallApprove!);
    await fireEvent.input(getByLabelText(/^Reviewer/), {
      target: { value: 'ops@example.com' },
    });

    const submit = requireElement(
      getByRole('button', { name: 'Submit decision' }),
      HTMLButtonElement,
    );
    expect(submit.disabled).toBe(false);
    await fireEvent.click(submit);

    expect(submissions).toEqual([{ decision: 'approved', reviewer: 'ops@example.com' }]);
  });
});
