import { fireEvent, render } from '@testing-library/svelte';
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
  onRestart?: (() => void) | undefined;
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
      ...(overrides.onRestart !== undefined ? { onRestart: overrides.onRestart } : {}),
    },
  });
}

describe('WorkflowDetailHeader', () => {
  test('renders the workflow type, version, and status badge', async () => {
    const { getByText } = renderHeader();

    expect(getByText('order-fulfillment')).not.toBeNull();
    expect(getByText('v2.4.1')).not.toBeNull();
    expect(getByText('Running')).not.toBeNull();
  });

  test('renders a distinct revision badge when the workflow has one', async () => {
    const { getByText } = renderHeader({
      workflow: workflow({ revision: 'sha256:abcdef1234567890' }),
    });

    // Truncated via `truncateId` (first8…last4), distinct from the version badge.
    expect(getByText(/^rev /)).not.toBeNull();
    expect(getByText('v2.4.1')).not.toBeNull();
  });

  test('renders an explicit "Unpinned (pre-revision record)" badge for a legacy workflow with no persisted revision', async () => {
    const { queryByText, getByText } = renderHeader({ workflow: workflow() });

    expect(queryByText(/^rev /)).toBeNull();
    expect(getByText('Unpinned (pre-revision record)')).not.toBeNull();
  });

  describe('active-revision comparison badge (WFT-117)', () => {
    const ACTIVE: WorkflowCatalogActivePointerLike = {
      revision: 'sha256:abcdef1234567890',
      generation: 3,
      activatedAt: 500,
    };

    test('reads "Active" when workflow.revision matches the active pointer', async () => {
      const { getByText } = renderHeader({
        workflow: workflow({ revision: ACTIVE.revision }),
        activeRevision: ACTIVE,
      });

      expect(getByText('Active')).not.toBeNull();
    });

    test('reads a distinct "Differs from active" icon+text treatment when they differ', async () => {
      const { getByText } = renderHeader({
        workflow: workflow({ revision: 'sha256:0000000000000000' }),
        activeRevision: ACTIVE,
      });

      expect(getByText('Differs from active')).not.toBeNull();
    });

    test('reads "Active revision unknown" when activeRevision is null (never activated)', async () => {
      const { getByText } = renderHeader({
        workflow: workflow({ revision: ACTIVE.revision }),
        activeRevision: null,
      });

      expect(getByText('Active revision unknown')).not.toBeNull();
    });

    test('reads "Active revision unknown" when activeRevision is undefined (denied/loading)', async () => {
      const { getByText } = renderHeader({
        workflow: workflow({ revision: ACTIVE.revision }),
        activeRevision: undefined,
      });

      expect(getByText('Active revision unknown')).not.toBeNull();
    });

    test('renders no comparison badge at all for an unpinned (legacy) workflow', async () => {
      const { queryByText } = renderHeader({ workflow: workflow(), activeRevision: ACTIVE });

      expect(queryByText('Active')).toBeNull();
      expect(queryByText('Active revision unknown')).toBeNull();
    });

    test('every non-unpinned tooltip carries the WFT-159 eager-registration hedge', async () => {
      const { container } = renderHeader({
        workflow: workflow({ revision: ACTIVE.revision }),
        activeRevision: ACTIVE,
      });

      const tooltipTexts = Array.from(container.querySelectorAll('[role="tooltip"]')).map(
        (el) => el.textContent ?? '',
      );
      const hedgeMentions = tooltipTexts.filter((text) =>
        text.includes("this process's currently loaded code"),
      );
      // The plain revision badge's own tooltip AND the comparison badge's
      // tooltip both carry the hedge — two distinct tooltips, not one.
      expect(hedgeMentions.length).toBe(2);
    });
  });

  test('running workflows offer cancel, suspend, and force timeout', async () => {
    const { getByRole } = renderHeader({ workflow: workflow({ status: 'running' }) });

    expect(getByRole('button', { name: 'Cancel' })).not.toBeNull();
    expect(getByRole('button', { name: 'Suspend' })).not.toBeNull();
    expect(getByRole('button', { name: 'Force timeout' })).not.toBeNull();
  });

  test('terminal workflows offer no contextual actions', async () => {
    const { queryByRole } = renderHeader({ workflow: workflow({ status: 'completed' }) });

    expect(queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  test('cancel opens a confirm dialog rather than calling onAction directly', async () => {
    let called = false;
    const { getByRole } = renderHeader({
      workflow: workflow({ status: 'running' }),
      onAction: () => {
        called = true;
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(called).toBe(false);
    expect(getByRole('dialog')).not.toBeNull();
  });

  test('suspend calls onAction directly with no confirm dialog', async () => {
    const received: { action: string | null } = { action: null };
    const { getByRole, queryByRole } = renderHeader({
      workflow: workflow({ status: 'running' }),
      onAction: (action) => {
        received.action = action;
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Suspend' }));
    expect(received.action).toBe('suspend');
    expect(queryByRole('dialog')).toBeNull();
  });
  test('offers Restart for every terminal status when a handler is wired, and calls it (COR-15)', async () => {
    for (const status of ['completed', 'failed', 'cancelled', 'timed-out'] as const) {
      let restarts = 0;
      const { getByRole, unmount } = renderHeader({
        workflow: workflow({ status }),
        onRestart: () => (restarts += 1),
      });

      await fireEvent.click(getByRole('button', { name: 'Restart' }));
      expect(restarts).toBe(1);
      unmount();
    }
  });

  test('offers no Restart for a non-terminal run or when no handler is wired (COR-15)', () => {
    for (const status of ['pending', 'running', 'suspended'] as const) {
      const { queryByRole, unmount } = renderHeader({
        workflow: workflow({ status }),
        onRestart: () => {},
      });
      expect(queryByRole('button', { name: 'Restart' })).toBeNull();
      unmount();
    }

    const { queryByRole } = renderHeader({ workflow: workflow({ status: 'completed' }) });
    expect(queryByRole('button', { name: 'Restart' })).toBeNull();
  });
});
