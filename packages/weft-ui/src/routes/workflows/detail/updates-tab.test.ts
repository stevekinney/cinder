import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { CoordinatedUpdateResult, WorkflowState } from '@lostgradient/weft';

import UpdatesTab from './updates-tab.svelte';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf_1',
    type: 'order-fulfillment',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('UpdatesTab', () => {
  test('shows "nothing sent yet" before any update is submitted', async () => {
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => ({ updateId: 'u1' }),
    };
    const { getByText } = render(UpdatesTab, { props: { client, workflow: workflow() } });

    expect(getByText('Nothing sent yet.')).not.toBeNull();
  });

  test('sends an update and shows the real settled result', async () => {
    const received: { call: { id: string; name: string; payload: unknown } | null } = {
      call: null,
    };
    const client = {
      submitCoordinatedUpdate: async (
        id: string,
        name: string,
        payload?: unknown,
      ): Promise<CoordinatedUpdateResult> => {
        received.call = { id, name, payload };
        return { updateId: 'u1', result: { discounted: true } };
      },
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.input(getByLabelText('Payload'), { target: { value: '{"code":"SAVE10"}' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(getByText('applyDiscount')).not.toBeNull();
    });
    expect(received.call).toEqual({
      id: 'wf_1',
      name: 'applyDiscount',
      payload: { code: 'SAVE10' },
    });
    await waitFor(() => {
      expect(getByText(/"discounted":true/)).not.toBeNull();
    });
  });

  test('shows the handler error when the update resolves with one', async () => {
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => ({
        updateId: 'u1',
        error: 'insufficient balance',
      }),
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(getByText('insufficient balance')).not.toBeNull();
    });
  });

  test('rejects invalid JSON payloads without calling the client', async () => {
    let called = false;
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => {
        called = true;
        return { updateId: 'u1' };
      },
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.input(getByLabelText('Payload'), { target: { value: '{not json' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    expect(called).toBe(false);
    expect(getByText(/Payload must be valid JSON/)).not.toBeNull();
  });

  test('shows a generic failure message when the client throws a non-Error value', async () => {
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => {
        throw 'boom';
      },
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(getByText('The update failed.')).not.toBeNull();
    });
  });

  test('shows the thrown Error message when the client rejects', async () => {
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => {
        throw new Error('network unreachable');
      },
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(getByText('network unreachable')).not.toBeNull();
    });
  });

  test('passes a trimmed idempotency key and a custom timeout through to the client', async () => {
    const received: { options: { timeout: number; idempotencyKey?: string } | null } = {
      options: null,
    };
    const client = {
      submitCoordinatedUpdate: async (
        _id: string,
        _name: string,
        _payload: unknown,
        options: { timeout: number; idempotencyKey?: string },
      ): Promise<CoordinatedUpdateResult> => {
        received.options = options;
        return { updateId: 'u1' };
      },
    };

    const { getByLabelText, getByRole } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.input(getByLabelText('Idempotency key'), { target: { value: '  key-123  ' } });
    await fireEvent.input(getByLabelText('Timeout (s)'), { target: { value: '5' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(received.options).toEqual({ timeout: 5_000, idempotencyKey: 'key-123' });
    });
  });

  test('an invalid timeout input is ignored, leaving the default timeout in effect', async () => {
    const received: { options: { timeout: number } | null } = { options: null };
    const client = {
      submitCoordinatedUpdate: async (
        _id: string,
        _name: string,
        _payload: unknown,
        options: { timeout: number },
      ): Promise<CoordinatedUpdateResult> => {
        received.options = options;
        return { updateId: 'u1' };
      },
    };

    const { getByLabelText, getByRole } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.input(getByLabelText('Timeout (s)'), { target: { value: '-5' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(received.options).toEqual({ timeout: 30_000 });
    });
  });

  test('shows a pending row with a countdown while the update is in flight, and disables Send meanwhile', async () => {
    const pendingUpdate: { resolve: ((value: CoordinatedUpdateResult) => void) | null } = {
      resolve: null,
    };
    const client = {
      submitCoordinatedUpdate: () =>
        new Promise<CoordinatedUpdateResult>((resolve) => {
          pendingUpdate.resolve = resolve;
        }),
    };

    const { getByLabelText, getByRole, getByText } = render(UpdatesTab, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Update name'), { target: { value: 'applyDiscount' } });
    await fireEvent.click(getByRole('button', { name: 'Send update' }));

    await waitFor(() => {
      expect(getByRole('button', { name: 'Sending…' }).hasAttribute('disabled')).toBe(true);
    });
    expect(getByText(/awaiting result/)).not.toBeNull();
    expect(getByText('pending')).not.toBeNull();

    pendingUpdate.resolve?.({ updateId: 'u1', result: { ok: true } });

    await waitFor(() => {
      expect(getByRole('button', { name: 'Send update' })).not.toBeNull();
    });
  });

  test('the Send button stays disabled while the update name is blank', () => {
    const client = {
      submitCoordinatedUpdate: async (): Promise<CoordinatedUpdateResult> => ({ updateId: 'u1' }),
    };

    const { getByRole } = render(UpdatesTab, { props: { client, workflow: workflow() } });

    expect(getByRole('button', { name: 'Send update' }).hasAttribute('disabled')).toBe(true);
  });
});
