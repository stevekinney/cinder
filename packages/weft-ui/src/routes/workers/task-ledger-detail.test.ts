import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import TaskLedgerDetailView from './task-ledger-detail-view.svelte';
import { parseTaskLedgerDetail } from './workers-data.ts';

const NOW = 1_700_000_000_000;

function queuedTask() {
  return {
    state: 'queued',
    operationId: 'op_ledger_123456789',
    workflowId: 'wf_1',
    workflowExecutionToken: 'token_1',
    workflowType: 'orders',
    activityName: 'chargeCard',
    queue: 'payments',
    priority: 7,
    headerKeys: ['traceparent', 'tenant-id'],
    visibilityTimeoutMilliseconds: 30_000,
    retryPolicy: {
      maxAttempts: 5,
      initialBackoff: '1s',
      backoffMultiplier: 2,
      maxBackoff: '1m',
    },
    executionRequirement: { deploymentName: 'payments-v2', buildId: 'build-42' },
    createdAt: NOW - 60_000,
    availableAt: NOW + 30_000,
    attempt: 2,
    retryCount: 1,
    requeueCount: 1,
  } as const;
}

describe('task ledger response validation', () => {
  test('accepts the published common ledger envelope', () => {
    expect(parseTaskLedgerDetail(queuedTask())).toEqual(queuedTask());
  });

  test('rejects malformed generated-operation output at the boundary', () => {
    expect(() => parseTaskLedgerDetail({ state: 'queued', operationId: 'op_bad' })).toThrow(
      'malformed task ledger response',
    );
  });
});

describe('TaskLedgerDetailView', () => {
  test('renders one state with attempt, dispatch, retry, and reservation evidence', () => {
    const { getByText } = render(TaskLedgerDetailView, {
      props: { task: parseTaskLedgerDetail(queuedTask()), now: NOW },
    });

    expect(getByText('Delayed')).not.toBeNull();
    expect(getByText('traceparent, tenant-id')).not.toBeNull();
    expect(getByText('Available · attempt 2 of 5')).not.toBeNull();
    expect(getByText(/deploymentName: payments-v2/)).not.toBeNull();
  });

  test('labels cached ledger evidence while an authoritative refresh is pending', () => {
    const { getByRole } = render(TaskLedgerDetailView, {
      props: { task: parseTaskLedgerDetail(queuedTask()), now: NOW, refreshing: true },
    });

    expect(getByRole('status').textContent).toContain('Cached ledger evidence remains visible');
  });

  test('makes failed adoption and retained terminal evidence explicit', () => {
    const task = parseTaskLedgerDetail({
      ...queuedTask(),
      state: 'terminal',
      disposition: 'resolved',
      resultDigest: 'sha256:abc',
      resultStatus: 'completed',
      terminalAt: NOW - 10_000,
      adopted: false,
    });
    const { getByText } = render(TaskLedgerDetailView, { props: { task, now: NOW } });

    expect(getByText(/has not been adopted/)).not.toBeNull();
    expect(getByText('Awaiting workflow adoption')).not.toBeNull();
    expect(getByText(/Terminal record retained/)).not.toBeNull();
    expect(getByText('resolved')).not.toBeNull();
    expect(getByText('completed')).not.toBeNull();
    expect(getByText('sha256:abc')).not.toBeNull();
  });

  test('renders cancellation and dead-letter evidence without reconstructing state', () => {
    const task = parseTaskLedgerDetail({
      ...queuedTask(),
      state: 'deadLettered',
      pendingStatus: 'failed',
      resultDigest: 'sha256:failed',
      error: 'card processor unavailable',
      deadLetteredAt: NOW - 5_000,
      persistenceFailureReason: 'terminal result could not be persisted',
      cancellationReason: 'operator requested cancellation',
      cancellationRequestedAt: NOW - 15_000,
    });
    const { getAllByText, getByText } = render(TaskLedgerDetailView, { props: { task, now: NOW } });

    expect(getByText('Dead lettered')).not.toBeNull();
    expect(getByText('sha256:failed')).not.toBeNull();
    expect(getByText('card processor unavailable')).not.toBeNull();
    expect(getByText('operator requested cancellation')).not.toBeNull();
    expect(getAllByText('terminal result could not be persisted')).toHaveLength(2);
  });

  test('renders active lease, heartbeat, deadline, and exhausted retry evidence', () => {
    const task = parseTaskLedgerDetail({
      ...queuedTask(),
      state: 'leased',
      attempt: 5,
      availableAt: undefined,
      leaseDeadline: NOW + 20_000,
      lastHeartbeatAt: NOW - 2_000,
      scheduleToCloseDeadline: NOW + 120_000,
      fairShareKey: 'tenant-42',
      stickyWorkflowId: 'wf_sticky',
      lastRequeueReason: 'lease expired',
    });
    const { getByText } = render(TaskLedgerDetailView, { props: { task, now: NOW } });

    expect(getByText('leased')).not.toBeNull();
    expect(getByText('Already dispatched')).not.toBeNull();
    expect(getByText('Exhausted · attempt 5 of 5')).not.toBeNull();
    expect(getByText('tenant-42')).not.toBeNull();
    expect(getByText('wf_sticky')).not.toBeNull();
    expect(getByText('lease expired')).not.toBeNull();
  });

  test('renders adopted terminal evidence and optional envelope defaults', () => {
    const task = parseTaskLedgerDetail({
      ...queuedTask(),
      state: 'terminal',
      priority: undefined,
      headerKeys: [],
      retryPolicy: undefined,
      executionRequirement: undefined,
      adopted: true,
      adoptedAt: NOW - 1_000,
      terminalAt: NOW - 2_000,
      disposition: 'resolved',
    });
    const { getByText } = render(TaskLedgerDetailView, { props: { task, now: NOW } });

    expect(getByText('Default')).not.toBeNull();
    expect(getByText('No retry policy')).not.toBeNull();
    expect(getByText(/Adopted/)).not.toBeNull();
    expect(getByText('No constrained capacity')).not.toBeNull();
  });
});
