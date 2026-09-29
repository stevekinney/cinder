/// <reference lib="dom" />
import { requiredInstance } from '@lostgradient/testing';

export function requiredChildren(parent: Element): HTMLElement[] {
  return Array.from(parent.children, (child) => requiredInstance(child, HTMLElement));
}

export function resizeObserverEntry(
  target: Element,
  width: number,
  height = 0,
): ResizeObserverEntry {
  return {
    target,
    contentRect: new DOMRectReadOnly(0, 0, width, height),
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    contentBoxSize: [{ inlineSize: width, blockSize: height }],
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
  };
}

export class TestResizeObserver implements ResizeObserver {
  static latest: TestResizeObserver | undefined;
  readonly #callback: ResizeObserverCallback;
  #target: Element | undefined;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
    TestResizeObserver.latest = this;
  }

  observe(target: Element): void {
    this.#target = target;
  }

  unobserve(target: Element): void {
    if (this.#target === target) this.#target = undefined;
  }

  disconnect(): void {
    this.#target = undefined;
  }

  trigger(width: number, height = 0): void {
    if (!this.#target) throw new Error('ResizeObserver callback requested before observe');
    this.#callback([resizeObserverEntry(this.#target, width, height)], this);
  }
}
