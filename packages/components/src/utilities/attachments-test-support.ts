/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, beforeEach } from 'bun:test';
import { resetScrollLock } from '../_internal/overlay.ts';
setupHappyDom();

const originalResizeObserver = globalThis.ResizeObserver;
const originalMutationObserver = globalThis.MutationObserver;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

export let animationFrameCallbacks = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

export class FakeResizeObserver implements ResizeObserver {
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

export class FakeMutationObserver implements MutationObserver {
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

export function setScrollMeasurements(
  node: HTMLElement,
  measurements: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop?: number;
    clientWidth?: number;
    scrollWidth?: number;
    scrollLeft?: number;
  },
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
  if (measurements.clientWidth !== undefined) {
    Object.defineProperty(node, 'clientWidth', {
      configurable: true,
      value: measurements.clientWidth,
    });
  }
  if (measurements.scrollWidth !== undefined) {
    Object.defineProperty(node, 'scrollWidth', {
      configurable: true,
      value: measurements.scrollWidth,
    });
  }
  if (measurements.scrollLeft !== undefined) {
    Object.defineProperty(node, 'scrollLeft', {
      configurable: true,
      value: measurements.scrollLeft,
      writable: true,
    });
  }
}

/** Put a global back exactly as `Object.getOwnPropertyDescriptor` captured it. */
export function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

export function flushAnimationFrames(): void {
  const callbacks = Array.from(animationFrameCallbacks.values());
  animationFrameCallbacks.clear();
  for (const callback of callbacks) {
    callback(performance.now());
  }
}

export function setupAttachmentTests(): void {
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
    resetScrollLock();
  });
}
