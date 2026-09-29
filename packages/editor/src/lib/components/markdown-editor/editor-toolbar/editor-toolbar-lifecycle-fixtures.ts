/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { createRawSnippet, tick } from 'svelte';

setupHappyDom();

type ResizeRecord = {
  callback: ResizeObserverCallback;
  observed: Element[];
  unobserved: Element[];
  disconnected: boolean;
};

export class RecordingResizeObserver implements ResizeObserver {
  static records: ResizeRecord[] = [];

  readonly record: ResizeRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, observed: [], unobserved: [], disconnected: false };
    RecordingResizeObserver.records.push(this.record);
  }

  observe(target: Element): void {
    this.record.observed.push(target);
  }

  unobserve(target: Element): void {
    this.record.unobserved.push(target);
  }

  disconnect(): void {
    this.record.disconnected = true;
  }

  emit(target: Element, width: number): void {
    const rect = new DOMRectReadOnly(0, 0, width, 0);
    const entry = {
      target,
      contentRect: rect,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } satisfies ResizeObserverEntry;
    this.record.callback([entry], this);
  }
}

export const activeMarks = {
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  link: false,
};
export const activeBlockType = { type: 'paragraph' as const };
const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const originalDivRectDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDivElement.prototype,
  'getBoundingClientRect',
);
const originalDivRect = HTMLDivElement.prototype.getBoundingClientRect.bind(
  HTMLDivElement.prototype,
);
let actionMeasurementWidth = 0;

export function actionsSnippet(label = 'Action') {
  return createRawSnippet(() => ({
    render: () => `<button data-testid="toolbar-action">${label}</button>`,
  }));
}

export function toolbarProps(id: string, actions?: ReturnType<typeof actionsSnippet>) {
  return actions === undefined
    ? { id, editorContext: null, activeMarks, activeBlockType }
    : { id, editorContext: null, activeMarks, activeBlockType, actions };
}

export function installResizeObserver(): void {
  RecordingResizeObserver.records = [];
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: RecordingResizeObserver,
  });
  HTMLDivElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('toolbar-actions-measure'))
      return new DOMRectReadOnly(0, 0, actionMeasurementWidth, 0);
    return originalDivRect.call(this);
  };
}

export function restoreResizeObserver(): void {
  if (originalResizeObserver) {
    Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserver);
  } else {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  }
  if (originalDivRectDescriptor)
    Object.defineProperty(
      HTMLDivElement.prototype,
      'getBoundingClientRect',
      originalDivRectDescriptor,
    );
}

export function setActionMeasurementWidth(width: number): void {
  actionMeasurementWidth = width;
}

export function toolbarElement(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`#${id}`);
  if (!element) throw new Error(`Toolbar ${id} was not rendered`);
  return element;
}

export function requiredElement<T extends Element>(element: T | null | undefined): T {
  if (!element) throw new Error('Expected required toolbar element');
  return element;
}

export function portaledTextGroup(toolbar: HTMLElement): HTMLElement {
  return requiredElement(
    [
      ...document.body.querySelectorAll<HTMLElement>(
        '[data-toolbar-flex-group-id="text-formatting"]',
      ),
    ].find((group) => !toolbar.contains(group) && group.closest('.cinder-popover')),
  );
}

export function observedToolbar(): ResizeRecord {
  const record = RecordingResizeObserver.records[0];
  if (!record) throw new Error('ResizeObserver was not constructed');
  return record;
}

export function latestObservedToolbar(): ResizeRecord {
  const record = RecordingResizeObserver.records.at(-1);
  if (!record) throw new Error('ResizeObserver was not constructed');
  return record;
}

export function setMeasuredWidth(element: Element | null, width: number): void {
  if (!element) throw new Error('Expected a measurable toolbar element');
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRectReadOnly(0, 0, width, 0),
  });
}

export function configureMeasurements(toolbar: HTMLElement, width: number, actionsWidth = 0): void {
  setMeasuredWidth(toolbar, width);
  setMeasuredWidth(toolbar.querySelector('.toolbar-leading'), 40);
  setMeasuredWidth(toolbar.querySelector('.toolbar-trigger-ghost'), 24);
  for (const group of toolbar.querySelectorAll('[data-toolbar-flex-group-id]'))
    setMeasuredWidth(group, 80);
  const actionsMeasure = toolbar.querySelector('.toolbar-actions-measure');
  if (actionsMeasure) setMeasuredWidth(actionsMeasure, actionsWidth);
}

export function emitResize(record: ResizeRecord, target: Element, width: number): void {
  const rect = new DOMRectReadOnly(0, 0, width, 0);
  const entry = {
    target,
    contentRect: rect,
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  } satisfies ResizeObserverEntry;
  const observer = {
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {},
  } satisfies ResizeObserver;
  record.callback([entry], observer);
}

export async function unmount(view: { unmount: () => void }): Promise<void> {
  view.unmount();
  await tick();
}
