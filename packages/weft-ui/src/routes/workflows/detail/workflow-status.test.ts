import { describe, expect, test } from 'bun:test';

import type { WorkflowFinalizerStatus, WorkflowStatus } from '@lostgradient/weft';

import {
  actionConfirmTier,
  actionLabel,
  availableActions,
  finalizerStatusPresentation,
  isTerminalStatus,
  statusMayHaveFinalizer,
  workflowStatusPresentation,
  type WorkflowContextualAction,
} from './workflow-status.ts';

const ALL_STATUSES: readonly WorkflowStatus[] = [
  'pending',
  'running',
  'suspended',
  'completed',
  'failed',
  'cancelled',
  'timed-out',
];

describe('workflowStatusPresentation', () => {
  test('every WorkflowStatus has a presentation', () => {
    for (const status of ALL_STATUSES) {
      const presentation = workflowStatusPresentation(status);
      expect(presentation.label.length).toBeGreaterThan(0);
    }
  });

  test('running is success/green, failed and timed-out are danger/red', () => {
    expect(workflowStatusPresentation('running').variant).toBe('success');
    expect(workflowStatusPresentation('failed').variant).toBe('danger');
    expect(workflowStatusPresentation('timed-out').variant).toBe('danger');
  });

  test('suspended is warning/amber, pending is info/blue', () => {
    expect(workflowStatusPresentation('suspended').variant).toBe('warning');
    expect(workflowStatusPresentation('pending').variant).toBe('info');
  });

  test('terminal completed/cancelled render as neutral/gray', () => {
    expect(workflowStatusPresentation('completed').variant).toBe('neutral');
    expect(workflowStatusPresentation('cancelled').variant).toBe('neutral');
  });
});

describe('statusMayHaveFinalizer', () => {
  test('only cancelled and timed-out may carry finalizer work', () => {
    for (const status of ALL_STATUSES) {
      expect(statusMayHaveFinalizer(status)).toBe(status === 'cancelled' || status === 'timed-out');
    }
  });
});

describe('finalizerStatusPresentation', () => {
  test('falls back to the plain status badge when finalizer is undefined (still loading)', () => {
    const presentation = finalizerStatusPresentation('cancelled', undefined);
    expect(presentation).toEqual(workflowStatusPresentation('cancelled'));
  });

  test('falls back to the plain status badge when finalizer is null (no finalizer work recorded)', () => {
    const presentation = finalizerStatusPresentation('cancelled', null);
    expect(presentation).toEqual(workflowStatusPresentation('cancelled'));
  });

  test('never renders a finalizer sub-state for completed/failed, even if a finalizer value is somehow passed', () => {
    const finalizer: WorkflowFinalizerStatus = { status: 'running', attempts: 1, startedAt: 1 };
    expect(finalizerStatusPresentation('completed', finalizer)).toEqual(
      workflowStatusPresentation('completed'),
    );
    expect(finalizerStatusPresentation('failed', finalizer)).toEqual(
      workflowStatusPresentation('failed'),
    );
  });

  test('pending/running finalizer renders "Finalizing" (amber, loader icon, tooltip)', () => {
    const inFlightFinalizers: readonly WorkflowFinalizerStatus[] = [
      { status: 'pending', attempts: 0 },
      { status: 'running', attempts: 1, startedAt: 1 },
    ];
    for (const finalizer of inFlightFinalizers) {
      const presentation = finalizerStatusPresentation('cancelled', finalizer);
      expect(presentation.label).toBe('Finalizing');
      expect(presentation.variant).toBe('warning');
      expect(presentation.icon).toBe('loader');
      expect(presentation.tooltip).toBeDefined();
    }
  });

  test('failed finalizer after a cancellation renders "Cancelled — cleanup failed" (danger, triangle-alert icon)', () => {
    const finalizer: WorkflowFinalizerStatus = {
      status: 'failed',
      attempts: 3,
      failedAt: 1,
      error: 'destroySandbox threw',
    };
    const presentation = finalizerStatusPresentation('cancelled', finalizer);
    expect(presentation.label).toBe('Cancelled — cleanup failed');
    expect(presentation.variant).toBe('danger');
    expect(presentation.icon).toBe('triangle-alert');
    expect(presentation.tooltip).toContain('destroySandbox threw');
  });

  test('failed finalizer after a timeout renders "Timed out — cleanup failed"', () => {
    const finalizer: WorkflowFinalizerStatus = {
      status: 'failed',
      attempts: 1,
      failedAt: 1,
      error: 'boom',
    };
    expect(finalizerStatusPresentation('timed-out', finalizer).label).toBe(
      'Timed out — cleanup failed',
    );
  });

  test('succeeded finalizer renders the plain terminal badge, not a special sub-state', () => {
    const finalizer: WorkflowFinalizerStatus = { status: 'succeeded', attempts: 1, completedAt: 1 };
    expect(finalizerStatusPresentation('cancelled', finalizer)).toEqual(
      workflowStatusPresentation('cancelled'),
    );
  });
});

describe('isTerminalStatus', () => {
  test('completed, failed, cancelled, timed-out are terminal', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('timed-out')).toBe(true);
  });

  test('pending, running, suspended are not terminal', () => {
    expect(isTerminalStatus('pending')).toBe(false);
    expect(isTerminalStatus('running')).toBe(false);
    expect(isTerminalStatus('suspended')).toBe(false);
  });
});

describe('availableActions', () => {
  test('terminal statuses offer no contextual actions', () => {
    for (const status of ALL_STATUSES) {
      if (!isTerminalStatus(status)) continue;
      expect(availableActions(status)).toEqual([]);
    }
  });

  test('running offers cancel, suspend, force-timeout (not resume)', () => {
    expect(availableActions('running')).toEqual(['cancel', 'suspend', 'force-timeout']);
  });

  test('suspended offers resume, cancel, force-timeout (not suspend)', () => {
    expect(availableActions('suspended')).toEqual(['resume', 'cancel', 'force-timeout']);
  });

  test('pending offers cancel and force-timeout only', () => {
    expect(availableActions('pending')).toEqual(['cancel', 'force-timeout']);
  });
});

describe('actionConfirmTier', () => {
  test('cancel and force-timeout are tier-2 (irreversible)', () => {
    expect(actionConfirmTier('cancel')).toBe('tier-2');
    expect(actionConfirmTier('force-timeout')).toBe('tier-2');
  });

  test('suspend and resume are direct (reversible round-trip)', () => {
    expect(actionConfirmTier('suspend')).toBe('direct');
    expect(actionConfirmTier('resume')).toBe('direct');
  });
});

describe('actionLabel', () => {
  test('every action has a non-empty label', () => {
    const actions: readonly WorkflowContextualAction[] = [
      'cancel',
      'suspend',
      'resume',
      'force-timeout',
    ];
    for (const action of actions) {
      expect(actionLabel(action).length).toBeGreaterThan(0);
    }
  });
});
