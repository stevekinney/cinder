import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import AsyncActivityDrawerHarness from './async-activity-drawer.test-harness.svelte';
import type { AttachedPendingActivity } from './async-activity-matching.ts';

function activity(overrides: Partial<AttachedPendingActivity> = {}): AttachedPendingActivity {
  return {
    token: 'async-act:v1:wf-1:0:1',
    operationId: 'op-1',
    activityName: 'printShippingLabel',
    attempt: 1,
    observedAt: 1_000,
    stepId: 'step-1',
    ...overrides,
  };
}

describe('AsyncActivityDrawer', () => {
  test('shows the token and the "not a secret" label', async () => {
    const client = {
      activity: { complete: async () => {}, completeExceptionally: async () => {} },
    };
    const { getByText } = render(AsyncActivityDrawerHarness, {
      props: { client, open: true, activity: activity(), onClose: () => {}, onResolved: () => {} },
    });

    expect(getByText('async-act:v1:wf-1:0:1')).not.toBeNull();
    expect(getByText(/deterministic identifier, not a secret/)).not.toBeNull();
  });

  test('completing calls client.activity.complete with the parsed JSON result and fires onResolved', async () => {
    const received: { call: { token: string; result: unknown } | null } = { call: null };
    const client = {
      activity: {
        complete: async (token: string, result?: unknown) => {
          received.call = { token, result };
        },
        completeExceptionally: async () => {},
      },
    };
    const resolved: { token: string | null } = { token: null };

    const { getByLabelText, getByRole } = render(AsyncActivityDrawerHarness, {
      props: {
        client,
        open: true,
        activity: activity(),
        onClose: () => {},
        onResolved: (token: string) => {
          resolved.token = token;
        },
      },
    });

    await fireEvent.input(getByLabelText(/Result/), { target: { value: '{"printed":true}' } });
    await fireEvent.click(getByRole('button', { name: 'Complete activity' }));

    await waitFor(() => {
      expect(received.call).toEqual({ token: 'async-act:v1:wf-1:0:1', result: { printed: true } });
    });
    expect(resolved.token).toBe('async-act:v1:wf-1:0:1');
  });

  test('failing calls client.activity.completeExceptionally with the plain-text error message', async () => {
    const received: { call: { token: string; error: unknown } | null } = { call: null };
    const client = {
      activity: {
        complete: async () => {},
        completeExceptionally: async (token: string, error: unknown) => {
          received.call = { token, error };
        },
      },
    };

    const { getByLabelText, getByRole } = render(AsyncActivityDrawerHarness, {
      props: { client, open: true, activity: activity(), onClose: () => {}, onResolved: () => {} },
    });

    await fireEvent.click(getByRole('radio', { name: 'Fail' }));
    await fireEvent.input(getByLabelText('Error message'), {
      target: { value: 'printer offline' },
    });
    await fireEvent.click(getByRole('button', { name: 'Fail activity' }));

    await waitFor(() => {
      expect(received.call).toEqual({ token: 'async-act:v1:wf-1:0:1', error: 'printer offline' });
    });
  });

  test('a NotFound fault shows the spent-token treatment and hides the form', async () => {
    const client = {
      activity: {
        complete: async () => {
          throw new HttpClientError(404, 'token not found or already used');
        },
        completeExceptionally: async () => {},
      },
    };

    const { getByRole, getByText, queryByRole } = render(AsyncActivityDrawerHarness, {
      props: { client, open: true, activity: activity(), onClose: () => {}, onResolved: () => {} },
    });

    await fireEvent.click(getByRole('button', { name: 'Complete activity' }));

    await waitFor(() => {
      expect(getByText('This token has been used.')).not.toBeNull();
    });
    expect(queryByRole('button', { name: 'Complete activity' })).toBeNull();
  });

  test('rejects invalid JSON in complete mode without calling the client', async () => {
    let called = false;
    const client = {
      activity: {
        complete: async () => {
          called = true;
        },
        completeExceptionally: async () => {},
      },
    };

    const { getByLabelText, getByRole, getByText } = render(AsyncActivityDrawerHarness, {
      props: { client, open: true, activity: activity(), onClose: () => {}, onResolved: () => {} },
    });

    await fireEvent.input(getByLabelText(/Result/), { target: { value: '{not json' } });
    await fireEvent.click(getByRole('button', { name: 'Complete activity' }));

    expect(called).toBe(false);
    expect(getByText(/Result must be valid JSON/)).not.toBeNull();
  });
});
