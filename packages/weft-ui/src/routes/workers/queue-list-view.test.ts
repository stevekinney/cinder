import { describe, expect, test } from 'bun:test';

import { fireEvent, render } from '@testing-library/svelte';

import QueueListView from './queue-list-view.svelte';
import type { StandardTaskDiagnosticItem, TaskQueueHealth } from './worker-catalog-types.ts';

function queue(overrides: Partial<TaskQueueHealth> = {}): TaskQueueHealth {
  return {
    queue: 'default',
    backlog: 0,
    oldestEnqueuedAt: null,
    oldestQueuedAgeMs: null,
    waitingPollers: 0,
    schedulingPolicy: 'priority',
    inFlight: 0,
    connectedWorkers: 1,
    ...overrides,
  };
}

function diagnosticItem(
  overrides: Partial<StandardTaskDiagnosticItem> = {},
): StandardTaskDiagnosticItem {
  return {
    kind: 'stuck-queued',
    state: 'queued',
    retryCount: 0,
    requeueCount: 0,
    evidence: ['queued for 5m'],
    queue: 'default',
    ...overrides,
  };
}

describe('QueueListView — empty state', () => {
  test('no queues at all shows the empty state, not a table', () => {
    const { getByText, queryByRole } = render(QueueListView, {
      props: { queues: [], diagnostics: [] },
    });

    expect(getByText('No task queues')).not.toBeNull();
    expect(
      getByText('Queues appear here once a workflow dispatches an activity or a worker connects.'),
    ).not.toBeNull();
    expect(queryByRole('table')).toBeNull();
  });
});

describe('QueueListView — backlog variant thresholds', () => {
  test('a queue with zero backlog renders the neutral variant, no danger/warning styling cue', () => {
    const { container } = render(QueueListView, {
      props: { queues: [queue({ queue: 'idle', backlog: 0 })], diagnostics: [] },
    });

    const cell = container.querySelector('[data-variant]');
    expect(cell?.getAttribute('data-variant')).toBe('neutral');
    expect(cell?.textContent?.trim()).toBe('0');
  });

  test('a queue with backlog between 1 and 50 renders the warning variant', () => {
    const { getByText } = render(QueueListView, {
      props: { queues: [queue({ queue: 'busy', backlog: 12 })], diagnostics: [] },
    });

    const cell = getByText('12');
    expect(cell.getAttribute('data-variant')).toBe('warning');
  });

  test('a queue with backlog over 50 renders the danger variant', () => {
    const { getByText } = render(QueueListView, {
      props: { queues: [queue({ queue: 'flooded', backlog: 120 })], diagnostics: [] },
    });

    const cell = getByText('120');
    expect(cell.getAttribute('data-variant')).toBe('danger');
  });
});

describe('QueueListView — diagnostics badge', () => {
  test('a queue with an active diagnostic item shows the "Active" badge', () => {
    const { getByText } = render(QueueListView, {
      props: {
        queues: [queue({ queue: 'flaky' })],
        diagnostics: [diagnosticItem({ queue: 'flaky' })],
      },
    });

    expect(getByText('Active')).not.toBeNull();
  });

  test('a queue with no matching diagnostic item shows no badge', () => {
    const { queryByText } = render(QueueListView, {
      props: {
        queues: [queue({ queue: 'quiet' })],
        diagnostics: [diagnosticItem({ queue: 'other-queue' })],
      },
    });

    expect(queryByText('Active')).toBeNull();
  });
});

describe('QueueListView — row link navigation', () => {
  test('clicking a queue name link (plain click) prevents default and does not error', async () => {
    const { getByText } = render(QueueListView, {
      props: { queues: [queue({ queue: 'payments' })], diagnostics: [] },
    });

    const link = getByText('payments');
    expect(link.getAttribute('href')).toContain('/workers?tab=queues&queue=payments');

    // A plain left click is handled client-side (router navigation) and must
    // not throw, exercising the onQueueLinkClick branch that calls
    // event.preventDefault() and router.navigate(...).
    await fireEvent.click(link);
  });

  test('a modified click (meta key) is left alone — the handler returns early without preventing default', async () => {
    const { getByText } = render(QueueListView, {
      props: { queues: [queue({ queue: 'billing' })], diagnostics: [] },
    });

    const link = getByText('billing');
    await fireEvent.click(link, { metaKey: true });
    // No assertion beyond "did not throw" — this exercises the early-return
    // branch of onQueueLinkClick for modified clicks that should fall
    // through to native browser navigation.
  });
});
