import { requireElement } from '../../../../tests/dom-test-support.ts';

import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import ReviewStep from './review-step.svelte';
import { EMPTY_ADVANCED_START_OPTIONS } from './start-wizard-state.ts';

const BASE_PROPS = {
  type: 'order-processing',
  payload: { orderId: 'ord-1' },
  advanced: EMPTY_ADVANCED_START_OPTIONS,
  onBack: () => {},
  onSubmit: () => {},
  activeRevision: 'order-processing-rev-active',
};

describe('ReviewStep', () => {
  test('shows the workflow type and Start button in the idle state', async () => {
    const { getByText, getByRole } = render(ReviewStep, {
      props: { ...BASE_PROPS, submitState: { status: 'idle' } },
    });

    expect(getByText('order-processing')).not.toBeNull();
    expect(getByRole('button', { name: 'Start workflow' })).not.toBeNull();
  });

  test('disables the submit button while pending', async () => {
    const { getByRole } = render(ReviewStep, {
      props: { ...BASE_PROPS, submitState: { status: 'pending' } },
    });

    expect(
      requireElement(getByRole('button', { name: 'Starting…' }), HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('shows a success result with a link to the new run and hides the form', async () => {
    const { getByRole, queryByRole } = render(ReviewStep, {
      props: {
        ...BASE_PROPS,
        submitState: { status: 'success', workflowId: 'wf_4a9f1234567890abcdef2c10' },
      },
    });

    const link = getByRole('link', { name: 'View →' });
    expect(link.getAttribute('href')).toBe('/workflows/wf_4a9f1234567890abcdef2c10');
    expect(queryByRole('button', { name: 'Start workflow' })).toBeNull();
  });

  test('shows the spent-idempotency-key explanation for that conflict shape', async () => {
    const { getByText } = render(ReviewStep, {
      props: {
        ...BASE_PROPS,
        submitState: {
          status: 'error',
          error: new HttpClientError(409, 'conflict'),
          isSpentIdempotencyKey: true,
        },
      },
    });

    expect(getByText(/already run and was purged/)).not.toBeNull();
  });

  test('shows the generic fault banner for a non-idempotency error', async () => {
    const { getByText } = render(ReviewStep, {
      props: {
        ...BASE_PROPS,
        submitState: {
          status: 'error',
          error: new HttpClientError(500, 'boom'),
          isSpentIdempotencyKey: false,
        },
      },
    });

    expect(getByText('Something went wrong')).not.toBeNull();
  });

  describe('active-revision note (WFT-117)', () => {
    test('shows "starts against active revision X" when activeRevision is defined', async () => {
      const { getByText } = render(ReviewStep, {
        props: { ...BASE_PROPS, submitState: { status: 'idle' } },
      });

      expect(getByText(/^Starts against active revision/)).not.toBeNull();
      expect(getByText('order-processing-rev-active')).not.toBeNull();
    });

    test('shows an explicit "active revision unknown" explanation, never blank, when undefined', async () => {
      const { getByText, queryByText } = render(ReviewStep, {
        props: { ...BASE_PROPS, activeRevision: undefined, submitState: { status: 'idle' } },
      });

      expect(queryByText(/^Starts against active revision/)).toBeNull();
      expect(getByText(/^Active revision unknown/)).not.toBeNull();
    });

    test('does not promise the run will use the catalog active revision when it is unknown (Codex review, PR #978, round 2) — eager registration and sole dynamic-source candidates can both bypass the active pointer', async () => {
      const { getByText, queryByText } = render(ReviewStep, {
        props: { ...BASE_PROPS, activeRevision: undefined, submitState: { status: 'idle' } },
      });

      expect(
        getByText(/a fresh start can run without consulting the active pointer at all/),
      ).not.toBeNull();
      expect(queryByText(/will still start against whichever revision is active/)).toBeNull();
    });

    test('carries the SAME eager-registration/dynamic-source caveat when activeRevision IS defined (Codex review, PR #978) — a fresh start can still bypass the catalog pointer even though a specific revision was shown', async () => {
      const { getByText } = render(ReviewStep, {
        props: { ...BASE_PROPS, submitState: { status: 'idle' } },
      });

      expect(getByText(/^Starts against active revision/)).not.toBeNull();
      expect(
        getByText(/a fresh start can run without consulting the active pointer at all/),
      ).not.toBeNull();
    });
  });
});
