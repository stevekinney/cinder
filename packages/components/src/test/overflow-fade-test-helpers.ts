/// <reference lib="dom" />

export class OverflowFadeResizeObserver implements ResizeObserver {
  static instances: OverflowFadeResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;
  readonly observedElements: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    OverflowFadeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    if (!this.observedElements.includes(target)) {
      this.observedElements.push(target);
    }
  }

  unobserve(target: Element): void {
    const index = this.observedElements.indexOf(target);
    if (index >= 0) this.observedElements.splice(index, 1);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observedElements.length = 0;
  }

  trigger(): void {
    this.callback([], this);
  }
}

let animationFrameCallbacks = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

export function installOverflowFadeTestEnvironment(): () => void {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  OverflowFadeResizeObserver.instances = [];
  animationFrameCallbacks = new Map();
  nextAnimationFrameId = 1;
  globalThis.ResizeObserver = OverflowFadeResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextAnimationFrameId;
    nextAnimationFrameId += 1;
    animationFrameCallbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    animationFrameCallbacks.delete(id);
  };

  return () => {
    globalThis.ResizeObserver = originalResizeObserver;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    OverflowFadeResizeObserver.instances = [];
    animationFrameCallbacks.clear();
  };
}

export function flushOverflowFadeAnimationFrames(): void {
  const callbacks = Array.from(animationFrameCallbacks.values());
  animationFrameCallbacks.clear();
  for (const callback of callbacks) {
    callback(performance.now());
  }
}

export function setScrollMeasurements(
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
