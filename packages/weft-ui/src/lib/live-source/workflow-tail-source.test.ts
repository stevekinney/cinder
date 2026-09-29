import {
  WorkflowCompletedEvent,
  WorkflowStartedEvent,
  type WorkflowEvent,
  type WorkflowEventTail,
} from '@lostgradient/weft';
import { waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { isTerminalWorkflowEventType } from './workflow-lifecycle-events.ts';
import { WorkflowTailSource, type WorkflowEventTailOpener } from './workflow-tail-source.svelte.ts';

/**
 * A fake `WorkflowEventTail`. Mirrors the real thing's key behavior for
 * testing purposes: pushing a terminal-typed event auto-ends the iteration
 * (matching `WorkflowEventTailLifecycle`'s real auto-close on
 * `WORKFLOW_TERMINAL_EVENT_TYPES`), and `end()` simulates a drop (iteration
 * ends without an explicit `close()` call) versus `close()` (consumer-
 * initiated, tracked via `closeCalls`).
 */
class FakeWorkflowEventTail implements WorkflowEventTail {
  closeCalls = 0;

  readonly #queue: WorkflowEvent[] = [];
  #waker: (() => void) | null = null;
  #done = false;
  readonly #connected = Promise.withResolvers<void>();

  markConnected(): void {
    this.#connected.resolve();
  }

  whenConnected(): Promise<void> {
    return this.#connected.promise;
  }

  push(frame: WorkflowEvent): void {
    this.#queue.push(frame);
    this.#wake();
    if (isTerminalWorkflowEventType(frame.type)) this.end();
  }

  /** Simulates a drop: iteration ends, but not via consumer `close()`. */
  end(): void {
    this.#done = true;
    this.#wake();
  }

  close(): void {
    this.closeCalls += 1;
    this.end();
  }

  #wake(): void {
    const waker = this.#waker;
    this.#waker = null;
    waker?.();
  }

  [Symbol.asyncIterator](): AsyncIterator<WorkflowEvent> {
    return this.#iterate();
  }

  async *#iterate(): AsyncGenerator<WorkflowEvent, void, void> {
    while (true) {
      while (this.#queue.length > 0) yield this.#queue.shift()!;
      if (this.#done) return;
      await new Promise<void>((resolve) => {
        this.#waker = resolve;
      });
    }
  }
}

class ScriptedTailOpener implements WorkflowEventTailOpener {
  readonly calls: string[] = [];
  readonly #tails: (() => WorkflowEventTail)[] = [];

  enqueue(factory: () => WorkflowEventTail): void {
    this.#tails.push(factory);
  }

  tail(id: string): WorkflowEventTail {
    this.calls.push(id);
    const factory = this.#tails.shift();
    if (factory === undefined) throw new Error('ScriptedTailOpener: no more tails queued');
    return factory();
  }
}

function event(type: string, data: Record<string, unknown> = {}): WorkflowEvent {
  return { type, timestamp: Date.now(), data };
}

/** Yields past pending microtasks/promise resolutions — for asserting a fake tail's internal `for await` had a chance to resume after `push()`, when there's no other observable condition to poll. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('WorkflowTailSource', () => {
  test('opens client.tail(id) once, immediately, at construction', () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    expect(opener.calls).toEqual(['wf_1']);
    expect(source.status).toBe('connecting');
    source.close();
  });

  test('whenConnected resolves and status becomes live once the tail connects', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    tail.markConnected();
    await source.whenConnected();
    expect(source.status).toBe('live');
    source.close();
  });

  test('delivers frames pushed after subscribe, in order', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    const received: WorkflowEvent[] = [];
    source.subscribe((frame) => received.push(frame));
    tail.markConnected();
    await source.whenConnected();

    tail.push(event('activity:started', { name: 'a' }));
    tail.push(event('activity:completed', { name: 'a' }));

    await waitFor(() => {
      expect(received).toHaveLength(2);
    });
    expect(received.map((e) => e.type)).toEqual(['activity:started', 'activity:completed']);
    source.close();
  });

  test('buffers frames that arrive before subscribe(), then flushes them in order on subscribe', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    tail.markConnected();
    await source.whenConnected();
    tail.push(event('activity:started'));
    tail.push(event('activity:completed'));
    // Pushing wakes the internal `for await` synchronously, but it needs a
    // real tick to actually resume and pull the queued events into the
    // pre-attach buffer before anyone has subscribed.
    await settle();

    const received: WorkflowEvent[] = [];
    source.subscribe((frame) => received.push(frame));
    expect(received.map((e) => e.type)).toEqual(['activity:started', 'activity:completed']);
    source.close();
  });

  test('drops the oldest buffered frame and reports "stale" once the pre-attach buffer overflows', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1', { bufferLimit: 3 });
    tail.markConnected();
    await source.whenConnected();

    for (let index = 0; index < 5; index += 1) tail.push(event('activity:started', { index }));
    await waitFor(() => {
      expect(source.status).toBe('stale');
    });

    const received: WorkflowEvent[] = [];
    source.subscribe((frame) => received.push(frame));
    // Only the last 3 of 5 survive the bounded buffer.
    expect(received.map((e) => e.data['index'])).toEqual([2, 3, 4]);
    expect(source.status).toBe('live'); // subscribing clears the stale flag
    source.close();
  });

  test('subscribe throws when a subscriber is already attached; unsubscribing frees the slot', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    const unsubscribe = source.subscribe(() => {});
    expect(() => source.subscribe(() => {})).toThrow(/only one subscriber/);

    unsubscribe();
    expect(() => source.subscribe(() => {})).not.toThrow();
    source.close();
  });

  test('reconnects after a drop with positional dedup — the subscriber sees each frame exactly once', async () => {
    const opener = new ScriptedTailOpener();
    const firstTail = new FakeWorkflowEventTail();
    opener.enqueue(() => firstTail);

    const source = new WorkflowTailSource(opener, 'wf_1', { computeReconnectDelayMs: () => 1 });
    const received: WorkflowEvent[] = [];
    source.subscribe((frame) => received.push(frame));
    firstTail.markConnected();
    await source.whenConnected();
    firstTail.push(event('activity:started', { name: 'a' }));
    await waitFor(() => {
      expect(received).toHaveLength(1);
    });

    // Simulate a drop, then a reconnect whose `client.tail()` call replays
    // the FULL history from the start (real weft `client.tail()` behavior)
    // plus one genuinely new event.
    const secondTail = new FakeWorkflowEventTail();
    opener.enqueue(() => secondTail);
    firstTail.end();

    await waitFor(() => {
      expect(opener.calls).toEqual(['wf_1', 'wf_1']);
    });
    secondTail.markConnected();
    secondTail.push(event('activity:started', { name: 'a' })); // replayed — already delivered
    secondTail.push(event('activity:completed', { name: 'a' })); // genuinely new

    await waitFor(() => {
      expect(received).toHaveLength(2);
    });
    expect(received.map((e) => e.type)).toEqual(['activity:started', 'activity:completed']);
    source.close();
  });

  test('settles to closed (does not reconnect) once a terminal workflow event is observed', async () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1', { computeReconnectDelayMs: () => 1 });
    const received: WorkflowEvent[] = [];
    source.subscribe((frame) => received.push(frame));
    tail.markConnected();
    await source.whenConnected();

    tail.push(event(WorkflowStartedEvent.type));
    tail.push(event(WorkflowCompletedEvent.type, { result: 'ok' }));

    await waitFor(() => {
      expect(source.status).toBe('closed');
    });
    expect(received.map((e) => e.type)).toEqual([
      WorkflowStartedEvent.type,
      WorkflowCompletedEvent.type,
    ]);
    // No reconnect attempt — the opener was called exactly once.
    expect(opener.calls).toEqual(['wf_1']);
  });

  test('status is "reconnecting" during the backoff window after a drop', async () => {
    const opener = new ScriptedTailOpener();
    const firstTail = new FakeWorkflowEventTail();
    opener.enqueue(() => firstTail);
    const secondTail = new FakeWorkflowEventTail();
    opener.enqueue(() => secondTail);

    const source = new WorkflowTailSource(opener, 'wf_1', { computeReconnectDelayMs: () => 20 });
    source.subscribe(() => {});
    firstTail.markConnected();
    await source.whenConnected();
    firstTail.end();

    await waitFor(() => {
      expect(source.status).toBe('reconnecting');
    });
    source.close();
  });

  test('close() closes the underlying tail, stops reconnecting, and settles whenConnected', () => {
    const opener = new ScriptedTailOpener();
    const tail = new FakeWorkflowEventTail();
    opener.enqueue(() => tail);

    const source = new WorkflowTailSource(opener, 'wf_1');
    source.close();
    expect(tail.closeCalls).toBe(1);
    expect(source.status).toBe('closed');
    expect(() => source.close()).not.toThrow();
  });

  test('opener throwing synchronously schedules a reconnect instead of crashing', async () => {
    const opener: WorkflowEventTailOpener = {
      tail(id: string): WorkflowEventTail {
        void id;
        throw new Error('transient failure opening tail');
      },
    };

    const source = new WorkflowTailSource(opener, 'wf_1', { computeReconnectDelayMs: () => 1 });
    await waitFor(() => {
      expect(source.status).toBe('reconnecting');
    });
    source.close();
  });
});
