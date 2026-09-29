import { describe, expect, test } from 'bun:test';

import { QueryClient } from '@tanstack/svelte-query';

import type { FleetEventFrame } from '../../../lib/live-source/fleet-event-source.svelte.ts';
import {
  WorkflowListLiveController,
  type WorkflowListLiveSource,
} from './workflow-list-live.svelte.ts';

function frame(overrides: Partial<FleetEventFrame> = {}): FleetEventFrame {
  return {
    kind: 'workflow:started',
    workflowId: 'wf_1',
    sequence: 1,
    cursor: 'c1',
    emittedAtMs: Date.now(),
    payload: {},
    ...overrides,
  };
}

/** A fleet event with no `workflowId` (e.g. `schedule:fired`) — a separate builder rather than overloading `frame()`'s options, since `exactOptionalPropertyTypes` forbids expressing "omit this key" as `workflowId: undefined` in an options object. */
function nonWorkflowFrame(
  overrides: Partial<Omit<FleetEventFrame, 'workflowId'>> = {},
): FleetEventFrame {
  return {
    kind: 'schedule:fired',
    sequence: 1,
    cursor: 'c1',
    emittedAtMs: Date.now(),
    payload: {},
    ...overrides,
  };
}

class FakeSource implements WorkflowListLiveSource {
  status: WorkflowListLiveSource['status'] = 'live';
  caughtUp = true;
  #subscribers = new Set<(frame: FleetEventFrame) => void>();

  subscribe(onFrame: (frame: FleetEventFrame) => void): () => void {
    this.#subscribers.add(onFrame);
    return () => this.#subscribers.delete(onFrame);
  }

  emit(f: FleetEventFrame): void {
    for (const subscriber of this.#subscribers) subscriber(f);
  }

  get subscriberCount(): number {
    return this.#subscribers.size;
  }
}

describe('WorkflowListLiveController', () => {
  test('starts disabled with no pending count', () => {
    const controller = new WorkflowListLiveController(new FakeSource(), new QueryClient());
    expect(controller.enabled).toBe(false);
    expect(controller.newCount).toBe(0);
  });

  test('enable() subscribes; disable() unsubscribes and clears the counter', () => {
    const source = new FakeSource();
    const controller = new WorkflowListLiveController(source, new QueryClient());

    controller.enable();
    expect(source.subscriberCount).toBe(1);
    source.emit(frame());
    expect(controller.newCount).toBe(1);

    controller.disable();
    expect(source.subscriberCount).toBe(0);
    expect(controller.newCount).toBe(0);
    expect(controller.enabled).toBe(false);
  });

  test('counts only workflow-scoped frames', () => {
    const source = new FakeSource();
    const controller = new WorkflowListLiveController(source, new QueryClient());
    controller.enable();

    source.emit(nonWorkflowFrame());
    expect(controller.newCount).toBe(0);

    source.emit(frame({ workflowId: 'wf_2' }));
    expect(controller.newCount).toBe(1);
  });

  test('does not count frames arriving before the connection has caught up (replay backlog)', () => {
    const source = new FakeSource();
    source.caughtUp = false;
    const controller = new WorkflowListLiveController(source, new QueryClient());
    controller.enable();

    source.emit(frame());
    source.emit(frame());
    expect(controller.newCount).toBe(0);

    source.caughtUp = true;
    source.emit(frame());
    expect(controller.newCount).toBe(1);
  });

  test('refresh() invalidates the workflows list query and clears the counter', async () => {
    const source = new FakeSource();
    const queryClient = new QueryClient();
    let invalidated: unknown;
    queryClient.invalidateQueries = (options: unknown) => {
      invalidated = options;
      return Promise.resolve();
    };

    const controller = new WorkflowListLiveController(source, queryClient);
    controller.enable();
    source.emit(frame());
    expect(controller.newCount).toBe(1);

    controller.refresh();

    expect(controller.newCount).toBe(0);
    expect(invalidated).toEqual({ queryKey: ['workflows', 'list'] });
  });

  test('enable()/disable() are idempotent', () => {
    const source = new FakeSource();
    const controller = new WorkflowListLiveController(source, new QueryClient());

    controller.enable();
    controller.enable();
    expect(source.subscriberCount).toBe(1);

    controller.disable();
    controller.disable();
    expect(source.subscriberCount).toBe(0);
  });

  test('dispose() disables', () => {
    const source = new FakeSource();
    const controller = new WorkflowListLiveController(source, new QueryClient());
    controller.enable();
    controller.dispose();
    expect(source.subscriberCount).toBe(0);
    expect(controller.enabled).toBe(false);
  });

  test('status mirrors the underlying source', () => {
    const source = new FakeSource();
    source.status = 'reconnecting';
    const controller = new WorkflowListLiveController(source, new QueryClient());
    expect(controller.status).toBe('reconnecting');
  });
});
