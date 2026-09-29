import { fireEvent, render, within } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { WorkflowFinalizerStatus, WorkflowState } from '@lostgradient/weft';

import type { WorkflowCatalogActivePointerLike } from '../../../lib/workflow-revision.ts';
import Header from './header.svelte';
import type { WorkflowContextualAction } from './workflow-status.ts';

function workflow(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: '4a9f8c31e7b2d05a6f912c10',
    type: 'order-fulfillment',
    status: 'running',
    input: {},
    versionTuple: { workflowVersion: '2.4.1' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

const noop = () => {};
const noopAsync = async () => undefined;

interface HeaderPropOverrides {
  workflow?: WorkflowState;
  now?: number;
  pendingAction?: WorkflowContextualAction | null;
  onAction?: (action: WorkflowContextualAction) => void;
  activeTab?: string;
  onNavigateToTab?: (tab: string) => void;
  finalizerStatus?: WorkflowFinalizerStatus | null | undefined;
  onRunQuery?: (name: string, input: string) => Promise<unknown>;
  activeRevision?: WorkflowCatalogActivePointerLike | null | undefined;
}

/** Renders `Header` with sensible defaults, overridable per test — keeps each test focused on what it varies rather than repeating the full prop set. */
function renderHeader(overrides: HeaderPropOverrides = {}) {
  return render(Header, {
    props: {
      workflow: overrides.workflow ?? workflow(),
      now: overrides.now ?? 2_000,
      pendingAction: overrides.pendingAction ?? null,
      onAction: overrides.onAction ?? noop,
      activeTab: overrides.activeTab ?? 'overview',
      onNavigateToTab: overrides.onNavigateToTab ?? noop,
      finalizerStatus: overrides.finalizerStatus ?? null,
      onRunQuery: overrides.onRunQuery ?? noopAsync,
      activeRevision: overrides.activeRevision,
    },
  });
}

describe('additional coverage', () => {
  test('Send signal navigates to the signals tab', async () => {
    const navigated: { tab: string | null } = { tab: null };
    const { getByRole } = renderHeader({
      onNavigateToTab: (tab) => {
        navigated.tab = tab;
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Send signal' }));
    expect(navigated.tab).toBe('signals');
  });

  test('tags render as badges', async () => {
    const { getByText } = renderHeader({ workflow: workflow({ tags: ['prod', 'tier-1'] }) });

    expect(getByText('prod')).not.toBeNull();
    expect(getByText('tier-1')).not.toBeNull();
  });

  test('a cancelled workflow with an in-flight finalizer renders "Finalizing" instead of "Cancelled" (weft#732 item 4)', async () => {
    const finalizerStatus: WorkflowFinalizerStatus = {
      status: 'running',
      attempts: 1,
      startedAt: 1,
    };
    const { getByText, queryByText } = renderHeader({
      workflow: workflow({ status: 'cancelled' }),
      finalizerStatus,
    });

    expect(getByText('Finalizing')).not.toBeNull();
    expect(queryByText('Cancelled')).toBeNull();
  });

  test('a cancelled workflow with a failed finalizer renders "Cancelled — cleanup failed"', async () => {
    const finalizerStatus: WorkflowFinalizerStatus = {
      status: 'failed',
      attempts: 3,
      failedAt: 1,
      error: 'destroySandbox threw',
    };
    const { getByText } = renderHeader({
      workflow: workflow({ status: 'cancelled' }),
      finalizerStatus,
    });

    expect(getByText('Cancelled — cleanup failed')).not.toBeNull();
  });

  test('a cancelled workflow with no finalizer work recorded renders the plain "Cancelled" badge', async () => {
    const { getByText } = renderHeader({ workflow: workflow({ status: 'cancelled' }) });

    expect(getByText('Cancelled')).not.toBeNull();
  });

  test('deadline countdown renders for a running workflow with an execution deadline', async () => {
    const { getByText } = renderHeader({
      workflow: workflow({ status: 'running', executionDeadline: 62_000 }),
    });

    expect(getByText(/deadline 1m/)).not.toBeNull();
  });

  test('deadline renders "passed" once the deadline has elapsed', async () => {
    const { getByText } = renderHeader({
      workflow: workflow({ status: 'running', executionDeadline: 1_000 }),
    });

    expect(getByText(/deadline passed/)).not.toBeNull();
  });

  test('no deadline is rendered for a terminal workflow, even with an execution deadline set', async () => {
    const { queryByText } = renderHeader({
      workflow: workflow({ status: 'completed', executionDeadline: 62_000 }),
    });

    expect(queryByText(/deadline/)).toBeNull();
  });

  test('a failed workflow with a failure category appends the category label to the badge', async () => {
    const { getByText } = renderHeader({
      workflow: workflow({ status: 'failed', failureCategory: 'timeout' }),
    });

    expect(getByText(/timeout/)).not.toBeNull();
  });

  test('suspended workflows offer resume, cancel, and force timeout', async () => {
    const { getByRole } = renderHeader({ workflow: workflow({ status: 'suspended' }) });

    expect(getByRole('button', { name: 'Resume' })).not.toBeNull();
    expect(getByRole('button', { name: 'Cancel' })).not.toBeNull();
    expect(getByRole('button', { name: 'Force timeout' })).not.toBeNull();
  });

  test('force timeout opens a confirm dialog', async () => {
    const { getByRole } = renderHeader({ workflow: workflow({ status: 'running' }) });

    await fireEvent.click(getByRole('button', { name: 'Force timeout' }));
    expect(getByRole('dialog')).not.toBeNull();
  });

  test('confirming the tier-2 dialog calls onAction and closes the dialog', async () => {
    const received: { action: string | null } = { action: null };
    const { getByRole, queryByRole } = renderHeader({
      workflow: workflow({ status: 'running' }),
      onAction: (action) => {
        received.action = action;
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Cancel' }));
    // The header's own "Cancel" action button stays in the DOM behind the
    // open dialog, so THREE buttons now read "Cancel": the header action,
    // the dialog's dismiss control, and the dialog's confirm control
    // (cancelLabel default vs. actionLabel('cancel')) — scope the query to
    // inside the dialog and take the last (confirm) of the remaining two.
    const dialog = getByRole('dialog');
    const dialogCancelButtons = within(dialog).getAllByRole('button', { name: 'Cancel' });
    expect(dialogCancelButtons).toHaveLength(2);
    const confirmButton = dialogCancelButtons[1];
    if (!confirmButton) throw new Error('expected a confirm button in the dialog');
    await fireEvent.click(confirmButton);

    expect(received.action).toBe('cancel');
    expect(queryByRole('dialog')).toBeNull();
  });

  test('cancelling the confirm dialog leaves onAction uncalled', async () => {
    let called = false;
    const { getByRole, queryByRole } = renderHeader({
      workflow: workflow({ status: 'running' }),
      onAction: () => {
        called = true;
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Cancel' }));
    const dialog = getByRole('dialog');
    const dialogCancelButtons = within(dialog).getAllByRole('button', { name: 'Cancel' });
    const dismissButton = dialogCancelButtons[0];
    if (!dismissButton) throw new Error('expected a dismiss button in the dialog');
    await fireEvent.click(dismissButton);

    expect(called).toBe(false);
    expect(queryByRole('dialog')).toBeNull();
  });

  test('pending action disables the other contextual action buttons', async () => {
    const { getByRole } = renderHeader({
      workflow: workflow({ status: 'running' }),
      pendingAction: 'suspend',
    });

    // The in-flight action's own button is disabled too (Cinder's `Button`
    // disables itself while `loading`), but it's distinguishable from the
    // other, non-loading disabled buttons via `aria-busy`.
    expect(getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    expect(getByRole('button', { name: 'Cancel' }).getAttribute('aria-busy')).not.toBe('true');
    expect(getByRole('button', { name: 'Suspend' }).hasAttribute('disabled')).toBe(true);
    expect(getByRole('button', { name: 'Suspend' }).getAttribute('aria-busy')).toBe('true');
  });

  test('Send update navigates to the updates tab and reflects aria-pressed', async () => {
    const navigated: { tab: string | null } = { tab: null };
    const { getByRole } = renderHeader({
      activeTab: 'updates',
      onNavigateToTab: (tab) => {
        navigated.tab = tab;
      },
    });

    const updateButton = getByRole('button', { name: 'Send update' });
    expect(updateButton.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(updateButton);
    expect(navigated.tab).toBe('updates');
  });

  test('Run query toggles the inline query panel open and closed', async () => {
    const { getByRole, queryByLabelText, getByLabelText } = renderHeader();

    const runQueryButton = getByRole('button', { name: 'Run query' });
    expect(queryByLabelText('Query name')).toBeNull();

    await fireEvent.click(runQueryButton);
    expect(getByLabelText('Query name')).not.toBeNull();
    expect(runQueryButton.getAttribute('aria-expanded')).toBe('true');

    await fireEvent.click(runQueryButton);
    expect(queryByLabelText('Query name')).toBeNull();
  });

  test('running a query renders the JSON result on success', async () => {
    const { getByRole, getByLabelText, findByText } = renderHeader({
      onRunQuery: async () => ({ status: 'ok' }),
    });

    await fireEvent.click(getByRole('button', { name: 'Run query' }));
    await fireEvent.input(getByLabelText('Query name'), { target: { value: 'getOrderStatus' } });
    await fireEvent.click(getByRole('button', { name: 'Run' }));

    expect(await findByText(/"status": "ok"/)).not.toBeNull();
  });

  test('a failing query renders the error message instead of a result', async () => {
    const { getByRole, getByLabelText, findByText } = renderHeader({
      onRunQuery: async () => {
        throw new Error('The query failed hard.');
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Run query' }));
    await fireEvent.input(getByLabelText('Query name'), { target: { value: 'getOrderStatus' } });
    await fireEvent.click(getByRole('button', { name: 'Run' }));

    expect(await findByText('The query failed hard.')).not.toBeNull();
  });

  test('the Run button stays disabled while the query name is blank', async () => {
    const { getByRole, getByLabelText } = renderHeader();

    await fireEvent.click(getByRole('button', { name: 'Run query' }));
    expect(getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(true);

    await fireEvent.input(getByLabelText('Query name'), { target: { value: '   ' } });
    expect(getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(true);
  });
});
