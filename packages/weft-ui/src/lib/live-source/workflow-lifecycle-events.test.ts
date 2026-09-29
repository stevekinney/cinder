import {
  WorkflowCancelledEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
  WorkflowResumedEvent,
  WorkflowStartedEvent,
  WorkflowSuspendedEvent,
  WorkflowTimedOutEvent,
} from '@lostgradient/weft';
import { describe, expect, test } from 'bun:test';

import {
  isTerminalWorkflowEventType,
  workflowStatusForEventType,
} from './workflow-lifecycle-events.ts';

describe('workflowStatusForEventType', () => {
  test('maps lifecycle events to their WorkflowStatus', () => {
    expect(workflowStatusForEventType(WorkflowStartedEvent.type)).toBe('running');
    expect(workflowStatusForEventType(WorkflowResumedEvent.type)).toBe('running');
    expect(workflowStatusForEventType(WorkflowSuspendedEvent.type)).toBe('suspended');
    expect(workflowStatusForEventType(WorkflowCompletedEvent.type)).toBe('completed');
    expect(workflowStatusForEventType(WorkflowFailedEvent.type)).toBe('failed');
    expect(workflowStatusForEventType(WorkflowCancelledEvent.type)).toBe('cancelled');
    expect(workflowStatusForEventType(WorkflowTimedOutEvent.type)).toBe('timed-out');
  });

  test('returns null for event types with no status transition', () => {
    expect(workflowStatusForEventType('activity:started')).toBeNull();
    expect(workflowStatusForEventType('signal:received')).toBeNull();
    expect(workflowStatusForEventType('unknown:kind')).toBeNull();
  });
});

describe('isTerminalWorkflowEventType', () => {
  test('is true for completed/failed/cancelled/timed-out', () => {
    expect(isTerminalWorkflowEventType(WorkflowCompletedEvent.type)).toBe(true);
    expect(isTerminalWorkflowEventType(WorkflowFailedEvent.type)).toBe(true);
    expect(isTerminalWorkflowEventType(WorkflowCancelledEvent.type)).toBe(true);
    expect(isTerminalWorkflowEventType(WorkflowTimedOutEvent.type)).toBe(true);
  });

  test('is false for running/suspended and unrelated event types (suspended is resumable, not terminal)', () => {
    expect(isTerminalWorkflowEventType(WorkflowStartedEvent.type)).toBe(false);
    expect(isTerminalWorkflowEventType(WorkflowResumedEvent.type)).toBe(false);
    expect(isTerminalWorkflowEventType(WorkflowSuspendedEvent.type)).toBe(false);
    expect(isTerminalWorkflowEventType('activity:started')).toBe(false);
  });
});
