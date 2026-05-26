/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { overflowFade } from './attachments.ts';

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
