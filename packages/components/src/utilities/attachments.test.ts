/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { _resetScrollLock } from '../_internal/overlay.ts';
import { setupHappyDom } from '../test/happy-dom.ts';
import { createBodyScrollLock, createClickOutside, overflowFade } from './attachments.ts';

setupHappyDom();

const originalResizeObserver = globalThis.ResizeObserver;
const originalMutationObserver = globalThis.MutationObserver;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

let animationFrameCallbacks = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;
  readonly observedElements: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observedElements.push(target);
  }

  unobserve(target: Element): void {
    const index = this.observedElements.indexOf(target);
    if (index >= 0) this.observedElements.splice(index, 1);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(): void {
    this.callback([], this);
  }
}

class FakeMutationObserver implements MutationObserver {
  static instances: FakeMutationObserver[] = [];

  readonly callback: MutationCallback;
  readonly observedNodes: Node[] = [];
  disconnected = false;

  constructor(callback: MutationCallback) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(target: Node): void {
    this.observedNodes.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): MutationRecord[] {
    return [];
  }

  trigger(): void {
    this.callback([], this);
  }
}

function setScrollMeasurements(
  node: HTMLElement,
  measurements: { clientHeight: number; scrollHeight: number; scrollTop?: number },
): void {
  Object.defineProperty(node, 'clientHeight', {
    configurable: true,
    value: measurements.clientHeight,
  });
  Object.defineProperty(node, 'scrollHeight', {
    configurable: true,
    value: measurements.scrollHeight,
  });
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    value: measurements.scrollTop ?? 0,
    writable: true,
  });
}

function flushAnimationFrames(): void {
  const callbacks = Array.from(animationFrameCallbacks.values());
  animationFrameCallbacks.clear();
  for (const callback of callbacks) {
    callback(performance.now());
  }
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  FakeMutationObserver.instances = [];
  animationFrameCallbacks = new Map();
  nextAnimationFrameId = 1;

  globalThis.ResizeObserver = FakeResizeObserver;
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextAnimationFrameId;
    nextAnimationFrameId += 1;
    animationFrameCallbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    animationFrameCallbacks.delete(id);
  };
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.MutationObserver = originalMutationObserver;
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  document.body.innerHTML = '';
  _resetScrollLock();
});

describe('createBodyScrollLock', () => {
  test('hides body overflow when attached', () => {
    const node = document.createElement('div');
    const cleanup = createBodyScrollLock()(node);

    expect(document.body.style.overflow).toBe('hidden');

    cleanup?.();
  });

  test('restores body overflow when released', () => {
    document.body.style.overflow = '';
    const node = document.createElement('div');
    const cleanup = createBodyScrollLock()(node);

    expect(document.body.style.overflow).toBe('hidden');
    cleanup?.();

    expect(document.body.style.overflow).toBe('');
  });

  test('two nested locks keep overflow hidden until both release (shared counter)', () => {
    _resetScrollLock();
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');

    const cleanupA = createBodyScrollLock()(nodeA);
    const cleanupB = createBodyScrollLock()(nodeB);

    expect(document.body.style.overflow).toBe('hidden');

    // Release first lock — page must still be locked because B is open.
    cleanupA?.();
    expect(document.body.style.overflow).toBe('hidden');

    // Release second lock — now the count reaches zero; scroll restores.
    cleanupB?.();
    expect(document.body.style.overflow).toBe('');
  });

  test('releasing the same attachment twice does not double-decrement the counter', () => {
    _resetScrollLock();
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');

    const cleanupA = createBodyScrollLock()(nodeA);
    createBodyScrollLock()(nodeB);

    expect(document.body.style.overflow).toBe('hidden');

    // Call the same cleanup twice — idempotent; counter should not drop below 1.
    cleanupA?.();
    cleanupA?.();

    // nodeB's lock is still active; overflow must remain hidden.
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('overflowFade', () => {
  test('sets data-cinder-overflows when content extends below the visible area', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    overflowFade()(node);

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });

  test('removes data-cinder-overflows when content fits', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('removes data-cinder-overflows when scrolled to the bottom', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('updates when mutations change scrollHeight without resizing the container', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });

    overflowFade()(node);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 140 });
    FakeMutationObserver.instances[0]?.trigger();
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });

  test('updates when existing descendant content resizes without a mutation', () => {
    const node = document.createElement('div');
    const child = document.createElement('div');
    node.appendChild(child);
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });

    overflowFade()(node);
    expect(FakeResizeObserver.instances[0]?.observedElements).toContain(node);
    expect(FakeResizeObserver.instances[0]?.observedElements).toContain(child);
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 150 });
    FakeResizeObserver.instances[0]?.trigger();
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });

  test('clears stale state and exits when ResizeObserver is unavailable', () => {
    const node = document.createElement('div');
    node.setAttribute('data-cinder-overflows', '');
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    const cleanup = overflowFade()(node);

    expect(cleanup).toBeUndefined();
    expect(node.hasAttribute('data-cinder-overflows')).toBe(false);
  });

  test('cleanup disconnects observers and removes pending scroll updates', () => {
    const node = document.createElement('div');
    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 160 });

    const cleanup = overflowFade()(node);
    expect(typeof cleanup).toBe('function');

    FakeResizeObserver.instances[0]?.trigger();
    expect(animationFrameCallbacks.size).toBe(1);

    cleanup?.();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(FakeMutationObserver.instances[0]?.disconnected).toBe(true);
    expect(animationFrameCallbacks.size).toBe(0);

    setScrollMeasurements(node, { clientHeight: 100, scrollHeight: 100 });
    node.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();

    expect(node.hasAttribute('data-cinder-overflows')).toBe(true);
  });
});

describe('createClickOutside', () => {
  let node: HTMLElement;
  let cleanup: (() => void) | void;

  beforeEach(() => {
    node = document.createElement('div');
    document.body.append(node);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    node.remove();
  });

  /** Invoke the attachment factory and capture its teardown. */
  function attach(options: Parameters<typeof createClickOutside>[0]): void {
    cleanup = createClickOutside(options)(node);
  }

  /**
   * Dispatch a bubbling, cancelable event of `type` from `target`. Use a concrete UI event
   * where possible so happy-dom routes it through the full capture→bubble tree to the
   * document-level capture listener the attachment registers.
   */
  function fire(type: string, target: EventTarget): void {
    const init = { bubbles: true, cancelable: true };
    const event =
      type === 'pointerdown'
        ? new (globalThis.PointerEvent ?? Event)(type, init)
        : type === 'touchstart'
          ? new (globalThis.TouchEvent ?? Event)(type, init)
          : new (globalThis.MouseEvent ?? Event)(type, init);
    target.dispatchEvent(event);
  }

  test('calls the handler on an outside click but not an inside click', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    const inner = document.createElement('button');
    node.append(inner);
    fire('click', inner);
    expect(calls).toBe(0);

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('respects a reactive `enabled` getter', () => {
    let calls = 0;
    let on = false;
    attach({ handler: () => (calls += 1), enabled: () => on });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0); // disabled

    on = true;
    fire('click', outside);
    expect(calls).toBe(1); // enabled
    outside.remove();
  });

  test('eventType: "pointerdown" listens for pointerdown, not click', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'pointerdown' });

    const outside = document.createElement('button');
    document.body.append(outside);

    // A click must NOT trigger a pointerdown-configured listener.
    fire('click', outside);
    expect(calls).toBe(0);

    fire('pointerdown', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "mousedown" listens for mousedown', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'mousedown' });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0);

    fire('mousedown', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "touchstart" listens for touchstart', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'touchstart' });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0);

    fire('touchstart', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "touchstart" ignores non-cancelable touches', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'touchstart' });

    const outside = document.createElement('button');
    document.body.append(outside);
    const event = new (globalThis.TouchEvent ?? Event)('touchstart', {
      bubbles: true,
      cancelable: false,
    });
    outside.dispatchEvent(event);

    expect(calls).toBe(0);
    outside.remove();
  });

  test('treats composedPath entries contained by the node as inside', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'pointerdown' });

    const inside = document.createElement('button');
    node.append(inside);
    const outside = document.createElement('button');
    document.body.append(outside);
    const event = new (globalThis.PointerEvent ?? Event)('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: outside });
    Object.defineProperty(event, 'composedPath', { value: () => [inside, node, document.body] });

    document.dispatchEvent(event);

    expect(calls).toBe(0);
    outside.remove();
  });

  test('ignoreRefs: a target inside an ignored ref does not trigger the handler', () => {
    let calls = 0;
    const trigger = document.createElement('button');
    document.body.append(trigger);
    attach({ handler: () => (calls += 1), ignoreRefs: [() => trigger] });

    // Clicking the trigger (outside `node` but in an ignored ref) must NOT close.
    fire('click', trigger);
    expect(calls).toBe(0);

    // A genuinely-outside click still triggers.
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    fire('click', elsewhere);
    expect(calls).toBe(1);

    trigger.remove();
    elsewhere.remove();
  });

  test('ignoreRefs resolves the ref freshly on each event (late-mounted trigger)', () => {
    let calls = 0;
    let trigger: HTMLElement | null = null;
    attach({ handler: () => (calls += 1), ignoreRefs: [() => trigger] });

    // Ref is null at attach time; mount the trigger afterward.
    trigger = document.createElement('button');
    document.body.append(trigger);

    fire('click', trigger);
    expect(calls).toBe(0); // resolved freshly -> recognized as inside

    trigger.remove();
  });

  test('removes its document listener on teardown', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);

    cleanup?.();
    cleanup = undefined;
    fire('click', outside);
    expect(calls).toBe(1); // no further calls after teardown
    outside.remove();
  });

  test('capture: false — bubble-phase listener is correctly removed on teardown', () => {
    // When capture:false, removeEventListener must be called with the same phase flag.
    // A regression that hard-codes `true` in removeEventListener would silently fail to
    // deregister the listener. This test verifies teardown symmetry for capture:false.
    let calls = 0;
    attach({ handler: () => (calls += 1), capture: false });

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);

    cleanup?.();
    cleanup = undefined;
    fire('click', outside);
    expect(calls).toBe(1); // listener removed — no further calls
    outside.remove();
  });

  test('non-Node target (null) is treated as outside and triggers the handler', () => {
    // Defensive branch: event.target can be null on synthetic events or in certain
    // shadow-DOM scenarios. A null target must NOT prevent the handler from firing.
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    // Override `target` with null via Object.defineProperty; `value: null` is
    // simpler and clearer than a getter and avoids the unused-variable pattern.
    const nullTargetEvent = Object.defineProperty(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
      'target',
      { value: null, configurable: true },
    );
    document.dispatchEvent(nullTargetEvent);
    expect(calls).toBe(1); // null target => treated as outside => handler fires
  });
});
