/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { expect } from 'bun:test';

setupHappyDom();

export const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
export const { default: TableOfContents } = await import('./table-of-contents.svelte');

export type ObserverRecord = {
  callback: IntersectionObserverCallback;
  observeTargets: Element[];
  disconnectCalls: number;
};

export class FakeIntersectionObserver implements IntersectionObserver {
  static records: ObserverRecord[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];

  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.record = {
      callback,
      observeTargets: [],
      disconnectCalls: 0,
    };
    FakeIntersectionObserver.records.push(this.record);
  }

  observe(target: Element): void {
    this.record.observeTargets.push(target);
  }

  disconnect(): void {
    this.record.disconnectCalls += 1;
  }

  unobserve(_target: Element): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

export const originalIntersectionObserver = globalThis.IntersectionObserver;

export function createHeading(id: string, text: string, tag: 'h2' | 'h3' = 'h2'): HTMLElement {
  const heading = document.createElement(tag);
  heading.id = id;
  heading.textContent = text;
  heading.scrollIntoView = () => {};
  return heading;
}

export function createEntry(
  target: Element,
  top: number,
  isIntersecting = true,
): IntersectionObserverEntry {
  return {
    boundingClientRect: new DOMRect(0, top, 0, 0),
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: new DOMRect(),
    isIntersecting,
    rootBounds: null,
    target,
    time: Date.now(),
  };
}

export async function waitForTableOfContentsLinks(
  container: Element,
  expectedCount: number,
): Promise<NodeListOf<HTMLAnchorElement>> {
  await waitFor(() => {
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(
      expectedCount,
    );
  });

  return container.querySelectorAll('a.cinder-table-of-contents__link');
}
