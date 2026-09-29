import { describe, expect, test } from 'bun:test';

import { fireEvent, render } from '@testing-library/svelte';

import DiagnosticsView from './diagnostics-view.svelte';
import type { StandardTaskDiagnosticItem, TaskDiagnosticsSummary } from './worker-catalog-types.ts';

const EMPTY_SUMMARY: TaskDiagnosticsSummary = {
  stuckQueued: 0,
  staleInflight: 0,
  retryStorms: 0,
  allWorkersAtCapacity: 0,
  deadLettered: 0,
  delayed: 0,
  unadoptedTerminal: 0,
};

function item(overrides: Partial<StandardTaskDiagnosticItem> = {}): StandardTaskDiagnosticItem {
  return {
    kind: 'stuck-queued',
    state: 'queued',
    retryCount: 0,
    requeueCount: 0,
    evidence: ['queued 5m without a poller'],
    queue: 'default',
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe('DiagnosticsView — empty state', () => {
  test('a zeroed summary shows the "No diagnostics" empty state even if items is non-empty', () => {
    // Exercises totalDiagnostics being derived from `summary`, not
    // `items.length` — the route always passes both from the same response,
    // but the view derives its emptiness purely from the summary fields.
    const { getByText } = render(DiagnosticsView, {
      props: { items: [], summary: EMPTY_SUMMARY, now: NOW },
    });

    expect(getByText('No diagnostics')).not.toBeNull();
    expect(
      getByText(
        'Nothing delayed, stuck, stale, retrying, at capacity, unadopted, or dead-lettered right now.',
      ),
    ).not.toBeNull();
  });
});

describe('DiagnosticsView — grouped kinds', () => {
  test('renders a card per non-empty kind, using guidance title/copy and affected count', async () => {
    const { getAllByRole, getByText, queryByText } = render(DiagnosticsView, {
      props: {
        items: [
          item({ kind: 'stuck-queued', queue: 'default', operationId: 'op_a' }),
          item({ kind: 'stuck-queued', queue: 'default', operationId: 'op_b' }),
        ],
        summary: { ...EMPTY_SUMMARY, stuckQueued: 2 },
        now: NOW,
      },
    });

    expect(getByText('Stuck queued')).not.toBeNull();
    expect(getByText('2 affected')).not.toBeNull();
    expect(getByText(/Tasks are queued but no worker has picked them up\./)).not.toBeNull();
    expect(queryByText('Dead lettered')).toBeNull();
    await fireEvent.click(getAllByRole('button', { name: 'Inspect ledger' })[0]!);
  });

  test('renders every kind at once when the summary reports all five as present', () => {
    const { getByText } = render(DiagnosticsView, {
      props: {
        items: [
          item({ kind: 'stuck-queued' }),
          item({ kind: 'dead-lettered', operationId: 'op_1' }),
          item({ kind: 'stale-inflight' }),
          item({ kind: 'retry-storm' }),
          item({ kind: 'all-workers-at-capacity' }),
        ],
        summary: {
          stuckQueued: 1,
          staleInflight: 1,
          retryStorms: 1,
          allWorkersAtCapacity: 1,
          deadLettered: 1,
          delayed: 0,
          unadoptedTerminal: 0,
        },
        now: NOW,
      },
    });

    expect(getByText('Stuck queued')).not.toBeNull();
    expect(getByText('Dead lettered')).not.toBeNull();
    expect(getByText('Stale in-flight')).not.toBeNull();
    expect(getByText('Retry storm')).not.toBeNull();
    expect(getByText('All workers at capacity')).not.toBeNull();
  });

  test('the dead-lettered group appends a relative "last …" timestamp when deadLetteredAt is present', () => {
    const { getByText } = render(DiagnosticsView, {
      props: {
        items: [
          item({
            kind: 'dead-lettered',
            operationId: 'op_dead',
            queue: 'payments',
            deadLetteredAt: NOW - 60_000,
          }),
        ],
        summary: { ...EMPTY_SUMMARY, deadLettered: 1 },
        now: NOW,
      },
    });

    expect(getByText(/queue: payments/)).not.toBeNull();
    expect(getByText(/· last/)).not.toBeNull();
  });

  test('a non-dead-lettered group with no deadLetteredAt omits the "last …" suffix', () => {
    const { getByText, queryByText } = render(DiagnosticsView, {
      props: {
        items: [item({ kind: 'retry-storm', queue: 'payments' })],
        summary: { ...EMPTY_SUMMARY, retryStorms: 1 },
        now: NOW,
      },
    });

    expect(getByText(/queue: payments/)).not.toBeNull();
    expect(queryByText(/· last/)).toBeNull();
  });

  test('evidence rows prefer workflowId over operationId when both are present', () => {
    const { getByText } = render(DiagnosticsView, {
      props: {
        items: [
          item({
            kind: 'stale-inflight',
            workflowId: 'wf_abcdefghijklmnop',
            operationId: 'op_should_not_render',
            evidence: ['heartbeat missed for 90s'],
          }),
        ],
        summary: { ...EMPTY_SUMMARY, staleInflight: 1 },
        now: NOW,
      },
    });

    expect(getByText('heartbeat missed for 90s')).not.toBeNull();
  });

  test('evidence rows show at most 3 items per group even when more are present', () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      item({
        kind: 'retry-storm',
        operationId: `op_${index}`,
        evidence: [`evidence-${index}`],
      }),
    );

    const { getByText, queryByText } = render(DiagnosticsView, {
      props: { items, summary: { ...EMPTY_SUMMARY, retryStorms: 5 }, now: NOW },
    });

    expect(getByText('evidence-0')).not.toBeNull();
    expect(getByText('evidence-1')).not.toBeNull();
    expect(getByText('evidence-2')).not.toBeNull();
    expect(queryByText('evidence-3')).toBeNull();
    expect(queryByText('evidence-4')).toBeNull();
  });
});
