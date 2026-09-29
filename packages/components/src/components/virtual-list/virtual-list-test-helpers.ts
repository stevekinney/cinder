/// <reference lib="dom" />
import type { Snippet } from 'svelte';
import { createRawSnippet } from 'svelte';

import { requiredInstance } from '@lostgradient/testing';
import type { VirtualListRowContext } from './virtual-list.types.ts';

export function makeItems(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Item ${index}`);
}

export function rowSnippet(): Snippet<[unknown, VirtualListRowContext]> {
  return createRawSnippet<[unknown, VirtualListRowContext]>(
    (getItem: () => unknown, getContext: () => VirtualListRowContext) => ({
      render: () =>
        `<div data-testid="virtual-row" data-index="${getContext().index}">${String(getItem())}</div>`,
    }),
  );
}

export function renderedRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="virtual-row"]'));
}

export type KeyedItem = { id: string; label: string };

export function keyedItemId(value: unknown): string {
  if (!isKeyedItem(value)) throw new TypeError('Expected a keyed virtual-list item');
  return value.id;
}

export function itemId(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string'
  ) {
    throw new TypeError('Expected an item with a string id');
  }
  return value.id;
}

export function keyedRowSnippet(): Snippet<[unknown, VirtualListRowContext]> {
  return createRawSnippet<[unknown, VirtualListRowContext]>((getItem: () => unknown) => ({
    render: () => {
      const item = getItem();
      if (!isKeyedItem(item)) throw new TypeError('Expected a keyed virtual-list item');
      return `<div data-testid="virtual-row" data-id="${item.id}">${item.label}</div>`;
    },
  }));
}

function isKeyedItem(value: unknown): value is KeyedItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'label' in value &&
    typeof value.label === 'string'
  );
}

type FakeResizeObserverRecord = {
  readonly callback: ResizeObserverCallback;
  readonly observed: HTMLElement[];
  readonly observer: ResizeObserver;
};

export const fakeResizeObservers: FakeResizeObserverRecord[] = [];
const originalResizeObserver = globalThis.ResizeObserver;

export class FakeResizeObserver implements ResizeObserver {
  readonly #record: FakeResizeObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.#record = { callback, observed: [], observer: this };
    fakeResizeObservers.push(this.#record);
  }

  observe(target: Element): void {
    this.#record.observed.push(requiredInstance(target, HTMLElement));
  }

  unobserve(target: Element): void {
    const index = this.#record.observed.indexOf(requiredInstance(target, HTMLElement));
    if (index !== -1) this.#record.observed.splice(index, 1);
  }

  disconnect(): void {
    this.#record.observed.length = 0;
  }
}

export function installFakeResizeObserver(): void {
  fakeResizeObservers.length = 0;
  globalThis.ResizeObserver = FakeResizeObserver;
}

export function restoreResizeObserver(): void {
  globalThis.ResizeObserver = originalResizeObserver;
  fakeResizeObservers.length = 0;
}

export function observedRowElements(): HTMLElement[] {
  return fakeResizeObservers.flatMap((record) =>
    record.observed.filter((element) => element.dataset['cinderVirtualIndex'] !== undefined),
  );
}

export function reportRowSizes(sizesByIndex: ReadonlyMap<number, number>): void {
  for (const record of fakeResizeObservers) {
    const entries = record.observed
      .filter((element) => {
        const raw = element.dataset['cinderVirtualIndex'];
        return raw !== undefined && sizesByIndex.has(Number.parseInt(raw, 10));
      })
      .map((element) => {
        const index = Number.parseInt(element.dataset['cinderVirtualIndex'] ?? '0', 10);
        const blockSize = sizesByIndex.get(index) ?? 0;
        return {
          target: element,
          borderBoxSize: [{ blockSize, inlineSize: 100 }],
          contentBoxSize: [{ blockSize, inlineSize: 100 }],
          devicePixelContentBoxSize: [{ blockSize, inlineSize: 100 }],
          contentRect: new DOMRectReadOnly(0, 0, 100, blockSize),
        };
      });
    if (entries.length > 0) record.callback(entries, record.observer);
  }
}

export function instrumentScrollTop(element: HTMLElement): {
  writes: () => number;
  value: () => number;
} {
  let value = element.scrollTop;
  let writes = 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      value = next;
      writes += 1;
    },
  });
  return { writes: () => writes, value: () => value };
}
