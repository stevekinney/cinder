import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { WorkflowFinalizerStatus } from '@lostgradient/weft';

import FinalizerStrip from './finalizer-strip.svelte';

describe('FinalizerStrip', () => {
  test('renders nothing when the workflow recorded no finalizer work', async () => {
    const { container } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status: null },
    });

    expect(container.textContent?.trim()).toBe('');
  });

  test('renders nothing while the finalizer query has not resolved yet', async () => {
    const { container } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status: undefined },
    });

    expect(container.textContent?.trim()).toBe('');
  });

  test('an in-flight finalizer shows the Finalizing badge and pending row', async () => {
    const status: WorkflowFinalizerStatus = { status: 'running', attempts: 1, startedAt: 1 };
    const { getByText } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status },
    });

    expect(getByText('Finalizing')).not.toBeNull();
    expect(getByText('Awaiting completion…')).not.toBeNull();
  });

  test('a failed finalizer shows the Failed badge, attempt count, and error text', async () => {
    const status: WorkflowFinalizerStatus = {
      status: 'failed',
      attempts: 3,
      failedAt: 1,
      error: 'cleanup handler threw: disk full',
    };
    const { getByText } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status },
    });

    expect(getByText('Cancelled — cleanup failed')).not.toBeNull();
    expect(getByText('Failed')).not.toBeNull();
    expect(getByText(/Teardown failed/)).not.toBeNull();
    expect(getByText(/3 attempts/)).not.toBeNull();
    expect(getByText('cleanup handler threw: disk full')).not.toBeNull();
  });

  test('a failed finalizer after a timeout uses "Timed out" wording, not "Cancelled"', async () => {
    const status: WorkflowFinalizerStatus = {
      status: 'failed',
      attempts: 1,
      failedAt: 1,
      error: 'boom',
    };
    const { getByText } = render(FinalizerStrip, {
      props: { baseStatus: 'timed-out', status },
    });

    expect(getByText('Timed out — cleanup failed')).not.toBeNull();
    expect(getByText(/runs after a timeout/)).not.toBeNull();
  });

  test('a succeeded finalizer shows a completed row with no special-status badge and no error text', async () => {
    const status: WorkflowFinalizerStatus = { status: 'succeeded', attempts: 1, completedAt: 1 };
    const { getByText, queryByText } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status },
    });

    expect(getByText(/Teardown completed/)).not.toBeNull();
    expect(queryByText('Special statuses')).toBeNull();
    expect(queryByText('Failed')).toBeNull();
  });

  test('a single attempt does not show an "N attempts" suffix', async () => {
    const status: WorkflowFinalizerStatus = { status: 'succeeded', attempts: 1, completedAt: 1 };
    const { queryByText } = render(FinalizerStrip, {
      props: { baseStatus: 'cancelled', status },
    });

    expect(queryByText(/attempts/)).toBeNull();
  });
});
