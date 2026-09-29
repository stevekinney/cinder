import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import { ChartInteraction } from './chart-interaction.svelte.ts';

setupHappyDom();

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observedElements = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observedElements.add(element);
  }

  unobserve(element: Element): void {
    this.observedElements.delete(element);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observedElements.clear();
  }

  resize(target: Element, width: number): void {
    this.callback(
      [
        {
          target,
          contentRect: new DOMRect(0, 0, width, 100),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this,
    );
  }
}

const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

beforeEach(() => {
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  document.body.replaceChildren();
  if (originalResizeObserver) {
    Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserver);
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
});

function requiredObserver(): FakeResizeObserver {
  const observer = FakeResizeObserver.instances[0];
  if (!observer) throw new Error('Expected the chart to create a ResizeObserver');
  return observer;
}

describe('ChartInteraction observeResize', () => {
  test('returns a no-op cleanup function when ResizeObserver is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    const interaction = new ChartInteraction();
    const cleanup = interaction.observeResize(document.createElement('div'));
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  test('attaches a ResizeObserver and returns a disconnect cleanup', () => {
    const interaction = new ChartInteraction();
    const element = document.createElement('div');
    const cleanup = interaction.observeResize(element);
    const observer = requiredObserver();

    expect([...observer.observedElements]).toContain(element);
    cleanup();
    expect(observer.disconnected).toBe(true);
  });

  test('updates measuredWidth from the ResizeObserver entry', () => {
    const interaction = new ChartInteraction();
    const element = document.createElement('div');
    const cleanup = interaction.observeResize(element);
    const observer = requiredObserver();

    try {
      observer.resize(element, 800);
      expect(interaction.measuredWidth).toBe(800);

      observer.resize(element, 0);
      // Width below 1 is clamped to 1 to avoid degenerate SVG viewboxes.
      expect(interaction.measuredWidth).toBe(1);
    } finally {
      cleanup();
    }
  });
});
