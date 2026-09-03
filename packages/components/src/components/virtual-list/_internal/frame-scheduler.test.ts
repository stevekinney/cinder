import { afterEach, describe, expect, mock, test } from 'bun:test';

import type { FrameScheduler } from './frame-scheduler.ts';
import { FrameBatcher, rafFrameScheduler } from './frame-scheduler.ts';

/**
 * A fully deterministic {@link FrameScheduler} fake: `request` never invokes
 * its callback on its own, so a test controls exactly when "the next frame"
 * fires by calling `fire()`. Mirrors the manual `requestAnimationFrame`
 * fakes already used elsewhere in this package (e.g.
 * `src/utilities/attachments.test.ts`), scoped as a `FrameScheduler` port
 * instead of a global override since `FrameBatcher` takes the scheduler as
 * an injected dependency rather than reading a global.
 */
function createFakeScheduler() {
  let nextId = 1;
  const pendingCallbacks = new Map<number, (time: number) => void>();
  const requestedIds: number[] = [];
  const cancelledIds: number[] = [];

  const scheduler: FrameScheduler = {
    request(callback) {
      const id = nextId;
      nextId += 1;
      pendingCallbacks.set(id, callback);
      requestedIds.push(id);
      return id;
    },
    cancel(id) {
      pendingCallbacks.delete(id);
      cancelledIds.push(id);
    },
  };

  return {
    scheduler,
    requestedIds,
    cancelledIds,
    pendingCount: () => pendingCallbacks.size,
    /** Fires every currently-pending frame callback, in request order. */
    fire(time = 0): void {
      const callbacks = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacks) callback(time);
    },
  };
}

describe('FrameBatcher', () => {
  test("coalesces three synchronous recordRead calls into exactly one onCommit call on the injected fake frame's callback", () => {
    const onCommit = mock((_value: number) => {});
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(onCommit, fake.scheduler);

    batcher.recordRead(1);
    batcher.recordRead(2);
    batcher.recordRead(3);

    expect(fake.requestedIds).toHaveLength(1);
    expect(onCommit).not.toHaveBeenCalled();

    fake.fire();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(3);
  });

  test('does not schedule a second frame for recordRead calls within the same pending frame', () => {
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<string>(() => {}, fake.scheduler);

    batcher.recordRead('a');
    batcher.recordRead('b');

    expect(fake.requestedIds).toEqual([1]);
  });

  test('a second batch after the first commits independently', () => {
    const onCommit = mock((_value: string) => {});
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<string>(onCommit, fake.scheduler);

    batcher.recordRead('first');
    fake.fire();

    batcher.recordRead('second-a');
    batcher.recordRead('second-b');
    fake.fire();

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenNthCalledWith(1, 'first');
    expect(onCommit).toHaveBeenNthCalledWith(2, 'second-b');
    expect(fake.requestedIds).toEqual([1, 2]);
  });

  test('dispose() before the frame fires prevents the commit', () => {
    const onCommit = mock((_value: number) => {});
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(onCommit, fake.scheduler);

    batcher.recordRead(42);
    batcher.dispose();
    fake.fire();

    expect(onCommit).not.toHaveBeenCalled();
  });

  test('cancel is actually called on dispose, with the id returned by request', () => {
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(() => {}, fake.scheduler);

    batcher.recordRead(1);
    expect(fake.requestedIds).toEqual([1]);

    batcher.dispose();

    expect(fake.cancelledIds).toEqual([1]);
    expect(fake.pendingCount()).toBe(0);
  });

  test('dispose() with nothing pending never calls cancel', () => {
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(() => {}, fake.scheduler);

    batcher.dispose();

    expect(fake.cancelledIds).toEqual([]);
  });

  test('dispose() is idempotent — a second call is a no-op', () => {
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(() => {}, fake.scheduler);

    batcher.recordRead(1);
    batcher.dispose();
    batcher.dispose();

    expect(fake.cancelledIds).toEqual([1]);
  });

  test('recordRead after dispose is inert: no commit, no new frame requested', () => {
    const onCommit = mock((_value: number) => {});
    const fake = createFakeScheduler();
    const batcher = new FrameBatcher<number>(onCommit, fake.scheduler);

    batcher.dispose();
    batcher.recordRead(99);
    fake.fire();

    expect(onCommit).not.toHaveBeenCalled();
    expect(fake.requestedIds).toEqual([]);
  });

  test('a frame that fires after dispose (scheduler ignored cancel) still does not commit', () => {
    // Defends the internal #disposed guard inside the scheduled callback
    // itself, independent of whether the injected scheduler's cancel()
    // actually prevents the callback from firing — a real
    // cancelAnimationFrame guarantees that, but this proves FrameBatcher
    // does not rely solely on the scheduler for the guarantee.
    const onCommit = mock((_value: number) => {});
    let capturedCallback: ((time: number) => void) | undefined;
    const scheduler: FrameScheduler = {
      request(callback) {
        capturedCallback = callback;
        return 1;
      },
      cancel() {
        // Deliberately does NOT prevent the captured callback from firing.
      },
    };
    const batcher = new FrameBatcher<number>(onCommit, scheduler);

    batcher.recordRead(7);
    batcher.dispose();
    capturedCallback?.(0);

    expect(onCommit).not.toHaveBeenCalled();
  });

  test('defaults to rafFrameScheduler when no scheduler is provided', () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    let capturedCallback: ((time: number) => void) | undefined;
    let requestCount = 0;

    try {
      globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        requestCount += 1;
        capturedCallback = callback;
        return 1;
      }) as typeof requestAnimationFrame;
      globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

      const onCommit = mock((_value: number) => {});
      const batcher = new FrameBatcher<number>(onCommit);

      batcher.recordRead(5);
      expect(requestCount).toBe(1);

      capturedCallback?.(0);
      expect(onCommit).toHaveBeenCalledWith(5);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});

describe('rafFrameScheduler', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test('request forwards the callback to requestAnimationFrame and returns its id', () => {
    let capturedCallback: FrameRequestCallback | undefined;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      capturedCallback = callback;
      return 123;
    }) as typeof requestAnimationFrame;

    const callback = mock((_time: number) => {});
    const id = rafFrameScheduler.request(callback);

    expect(id).toBe(123);
    capturedCallback?.(16);
    expect(callback).toHaveBeenCalledWith(16);
  });

  test('cancel forwards the id to cancelAnimationFrame', () => {
    const cancel = mock((_id: number) => {});
    globalThis.cancelAnimationFrame = cancel as typeof cancelAnimationFrame;

    rafFrameScheduler.cancel(456);

    expect(cancel).toHaveBeenCalledWith(456);
  });

  test('request returns a sentinel and never invokes the callback when requestAnimationFrame is absent', () => {
    // @ts-expect-error — deliberately simulating an environment (server
    // rendering) where this global does not exist.
    globalThis.requestAnimationFrame = undefined;

    const callback = mock((_time: number) => {});
    const id = rafFrameScheduler.request(callback);

    expect(id).toBe(-1);
    expect(callback).not.toHaveBeenCalled();
  });

  test('cancel is a safe no-op when cancelAnimationFrame is absent', () => {
    // @ts-expect-error — deliberately simulating an environment (server
    // rendering) where this global does not exist.
    globalThis.cancelAnimationFrame = undefined;

    expect(() => rafFrameScheduler.cancel(-1)).not.toThrow();
  });
});

/**
 * CIN-205 (SSR import safety) is a static property of `frame-scheduler.ts`
 * itself: `requestAnimationFrame`/`cancelAnimationFrame` are referenced only
 * as `globalThis.*` property lookups inside `request`/`cancel`'s function
 * bodies, never as bare identifiers at module scope — so merely importing
 * this module (already exercised, at the top of this file, before any test
 * runs) cannot throw regardless of which globals exist. The two "absent"
 * tests above (`request returns a sentinel…`, `cancel is a safe no-op…`)
 * cover the resulting runtime behavior once loaded.
 */
