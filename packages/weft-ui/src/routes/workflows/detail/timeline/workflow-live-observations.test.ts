import { describe, expect, test } from 'bun:test';

import type { FleetEventFrame } from '../../../../lib/live-source/fleet-event-source.svelte.ts';
import {
  type FleetSubscribable,
  WorkflowLiveObservations,
} from './workflow-live-observations.svelte.ts';

class FakeFleet implements FleetSubscribable {
  caughtUp = false;
  #handler: ((frame: FleetEventFrame) => void) | null = null;

  subscribe(onFrame: (frame: FleetEventFrame) => void): () => void {
    this.#handler = onFrame;
    return () => {
      this.#handler = null;
    };
  }

  emit(eventFrame: FleetEventFrame): void {
    this.#handler?.(eventFrame);
  }
}

function frame(overrides: Partial<FleetEventFrame> & { kind: string }): FleetEventFrame {
  return {
    workflowId: 'wf-1',
    sequence: 1,
    cursor: '1',
    emittedAtMs: 1_000,
    payload: {},
    ...overrides,
  };
}

interface FakeQueryClient {
  readonly invalidated: unknown[][];
  invalidateQueries: (filters?: { queryKey?: unknown }) => Promise<void>;
}

function fakeQueryClient(): FakeQueryClient {
  const invalidated: unknown[][] = [];
  return {
    invalidated,
    async invalidateQueries(filters) {
      const queryKey = filters?.queryKey;
      invalidated.push(Array.isArray(queryKey) ? queryKey : []);
    },
  };
}

describe('WorkflowLiveObservations', () => {
  test('records an activity:async-pending frame with a well-formed payload', () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');

    fleet.emit(
      frame({
        kind: 'activity:async-pending',
        payload: {
          token: 'async-act:v1:wf-1:0:1',
          operationId: 'op-1',
          activityName: 'printShippingLabel',
          attempt: 1,
        },
      }),
    );

    expect(observations.pendingAsyncActivities).toEqual([
      {
        token: 'async-act:v1:wf-1:0:1',
        operationId: 'op-1',
        activityName: 'printShippingLabel',
        attempt: 1,
        observedAt: 1_000,
      },
    ]);
  });

  test('ignores a malformed activity:async-pending payload rather than crashing or fabricating a token', () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');

    fleet.emit(frame({ kind: 'activity:async-pending', payload: { token: 'only-a-token' } }));

    expect(observations.pendingAsyncActivities).toEqual([]);
  });

  test('de-duplicates the same token observed twice (e.g. reconnect replay overlap)', () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');
    const payload = { token: 't-1', operationId: 'op-1', activityName: 'a', attempt: 1 };

    fleet.emit(frame({ kind: 'activity:async-pending', payload }));
    fleet.emit(frame({ kind: 'activity:async-pending', payload }));

    expect(observations.pendingAsyncActivities).toHaveLength(1);
  });

  test("forgetToken drops the observation locally (the console's own drawer resolved it)", () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');
    fleet.emit(
      frame({
        kind: 'activity:async-pending',
        payload: { token: 't-1', operationId: 'op-1', activityName: 'a', attempt: 1 },
      }),
    );

    observations.forgetToken('t-1');

    expect(observations.pendingAsyncActivities).toEqual([]);
  });

  test('every frame for this workflow invalidates the timeline query so a resolved step self-heals', () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');
    void observations;

    fleet.emit(frame({ kind: 'activity:started', payload: {} }));

    expect(queryClient.invalidated).toEqual([
      ['workflows', 'timeline', 'wf-1'],
      ['workflows', 'pending-async-activities', 'wf-1'],
    ]);
  });

  test('dispose unsubscribes from the fleet feed', () => {
    const fleet = new FakeFleet();
    const queryClient = fakeQueryClient();
    const observations = new WorkflowLiveObservations(fleet, queryClient, 'wf-1');
    observations.dispose();

    fleet.emit(
      frame({
        kind: 'activity:async-pending',
        payload: { token: 't-1', operationId: 'op-1', activityName: 'a', attempt: 1 },
      }),
    );

    expect(observations.pendingAsyncActivities).toEqual([]);
  });
});
