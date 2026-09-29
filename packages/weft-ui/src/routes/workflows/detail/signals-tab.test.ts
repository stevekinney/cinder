import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { WorkflowState, WorkflowTimelineEntry } from '@lostgradient/weft';

import SignalsTabHarness from './signals-tab.test-harness.svelte';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'wf_1',
    type: 'signal-stepped',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('SignalsTab', () => {
  test('shows an empty message when no signal has been delivered to a wait point', async () => {
    const client = {
      signal: async () => {},
      getTimeline: async (): Promise<WorkflowTimelineEntry[]> => [],
    };

    const { getByText } = render(SignalsTabHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('No signals delivered to a wait point yet.')).not.toBeNull();
    });
  });

  test('lists wait-signal timeline entries as received signals', async () => {
    const client = {
      signal: async () => {},
      getTimeline: async (): Promise<WorkflowTimelineEntry[]> => [
        {
          step: 1,
          operationType: 'wait-signal',
          operationLabel: 'advance',
          inputSummary: '{}',
          timestamp: 1_000,
          status: 'completed',
        },
      ],
    };

    const { getByText } = render(SignalsTabHarness, {
      props: { client, workflow: workflow() },
    });

    await waitFor(() => {
      expect(getByText('advance')).not.toBeNull();
    });
  });

  test('sends a signal with the entered name and JSON payload', async () => {
    const sent: { call: { id: string; name: string; payload: unknown } | null } = { call: null };
    const client = {
      // `id: string` (the only overload SignalsTab actually calls) plus a
      // loose `...rest` covers the other two `signal()` overloads
      // (`SignalDefinition`-first) without needing to satisfy their exact
      // variance — this fake only ever receives the string-name call.
      signal: async (id: string, ...rest: unknown[]) => {
        const name = rest[0];
        if (typeof name !== 'string') throw new Error('signal name missing');
        sent.call = { id, name, payload: rest[1] };
      },
      getTimeline: async (): Promise<WorkflowTimelineEntry[]> => [],
    };

    const { getByLabelText, getByRole } = render(SignalsTabHarness, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'addItem' } });
    await fireEvent.input(getByLabelText('Payload'), { target: { value: '{"sku":"ABC-123"}' } });
    await fireEvent.click(getByRole('button', { name: 'Send signal' }));

    expect(sent.call).toEqual({ id: 'wf_1', name: 'addItem', payload: { sku: 'ABC-123' } });
  });

  test('rejects invalid JSON payloads without calling client.signal', async () => {
    const outcome: { called: boolean } = { called: false };
    const client = {
      signal: async () => {
        outcome.called = true;
      },
      getTimeline: async (): Promise<WorkflowTimelineEntry[]> => [],
    };

    const { getByLabelText, getByRole, getByText } = render(SignalsTabHarness, {
      props: { client, workflow: workflow() },
    });

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'addItem' } });
    await fireEvent.input(getByLabelText('Payload'), { target: { value: '{not json' } });
    await fireEvent.click(getByRole('button', { name: 'Send signal' }));

    expect(outcome.called).toBe(false);
    expect(getByText(/Payload must be valid JSON/)).not.toBeNull();
  });
});
