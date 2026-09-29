/// <reference lib="dom" />
import { requiredInstance } from '@lostgradient/testing';
import { expect } from 'bun:test';
import { tick } from 'svelte';
const { fireEvent } = await import('@testing-library/svelte');

export class CapturingResizeObserver implements ResizeObserver {
  static lastCallback: ResizeObserverCallback | null = null;
  static lastObserver: CapturingResizeObserver | null = null;

  readonly observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    CapturingResizeObserver.lastCallback = callback;
    CapturingResizeObserver.lastObserver = this;
  }

  observe(target: Element): void {
    if (!this.observed.includes(target)) this.observed.push(target);
  }

  unobserve(target: Element): void {
    const index = this.observed.indexOf(target);
    if (index >= 0) this.observed.splice(index, 1);
  }

  disconnect(): void {
    this.observed.length = 0;
  }
}

export async function withResizeObserver(run: () => void | Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  CapturingResizeObserver.lastCallback = null;
  CapturingResizeObserver.lastObserver = null;
  globalThis.ResizeObserver = CapturingResizeObserver;

  try {
    await run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'ResizeObserver', descriptor);
    else Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
}

export function emitNavigationBarResize(target: Element, width: number): void {
  const observer = CapturingResizeObserver.lastObserver;
  const callback = CapturingResizeObserver.lastCallback;
  if (!observer || !callback || !observer.observed.includes(target)) {
    throw new Error('ResizeObserver callback requested before observing the target');
  }
  const contentRect = new DOMRectReadOnly(0, 0, width, 0);
  const entry: ResizeObserverEntry = {
    target,
    contentRect,
    borderBoxSize: [{ inlineSize: width, blockSize: 0 }],
    contentBoxSize: [{ inlineSize: width, blockSize: 0 }],
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 0 }],
  };
  callback([entry], observer);
}

export function getItemsRegion(container: HTMLElement): HTMLElement {
  return requiredInstance(
    container.querySelector('.cinder-navigation-bar__items') ??
      document.body.querySelector('.cinder-navigation-bar__items'),
    HTMLElement,
  );
}

export async function openCollapsedMobileMenu(container: HTMLElement): Promise<HTMLElement> {
  await tick();
  const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
  const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);

  emitNavigationBarResize(nav, 640);
  await tick();

  await fireEvent.click(toggle);
  expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

  return nav;
}

export async function waitForMobilePanelPosition(container: HTMLElement): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const itemsRegion = getItemsRegion(container);
    if (itemsRegion.hasAttribute('data-cinder-position-ready')) return itemsRegion;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('NavigationBar mobile panel did not finish positioning.');
}

export async function setCollapsedMobileLayout(container: HTMLElement): Promise<void> {
  await tick();
  const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
  emitNavigationBarResize(nav, 640);
  await tick();
}

/** Creates a Svelte 5 Snippet that renders text content. */
