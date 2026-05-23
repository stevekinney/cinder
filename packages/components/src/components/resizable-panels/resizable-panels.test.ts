/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  callback: ResizeObserverCallback;
  target: Element | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element): void {
    this.target = target;
  }

  disconnect(): void {}

  unobserve(): void {}

  static flush(): void {
    for (const instance of ResizeObserverStub.instances) {
      if (!instance.target) continue;
      instance.callback(
        [
          {
            target: instance.target,
            contentRect: instance.target.getBoundingClientRect(),
          } as ResizeObserverEntry,
        ],
        instance as unknown as ResizeObserver,
      );
    }
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverStub,
});

const { cleanup, render } = await import('@testing-library/svelte/pure');
const { default: ResizablePanels } = await import('./resizable-panels.svelte');
const { createRawSnippet } = await import('svelte');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  ResizeObserverStub.instances = [];
});

const panes = [
  {
    id: 'sidebar',
    label: 'Sidebar',
    defaultSize: { value: 25, unit: 'percent' },
    minSize: { value: 120, unit: 'px' },
    collapsible: true,
  },
  {
    id: 'editor',
    label: 'Editor',
    defaultSize: { value: 75, unit: 'percent' },
    minSize: { value: 30, unit: 'percent' },
  },
] satisfies import('./resizable-panels.types.ts').ResizablePanelDefinition[];

const textSnippet = createRawSnippet<
  [
    import('./resizable-panels.types.ts').ResizablePanelDefinition,
    import('./resizable-panels.types.ts').ResizablePanelRenderContext,
  ]
>((getPane) => ({
  render: () => `<div>${getPane().label}</div>`,
}));

function mockMeasurements(container: HTMLElement): void {
  const root = container.querySelector<HTMLElement>('.cinder-resizable-panels');
  const handle = container.querySelector<HTMLElement>('.cinder-resizable-panels__handle');
  root!.getBoundingClientRect = () =>
    ({
      width: 800,
      height: 400,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  handle!.getBoundingClientRect = () =>
    ({
      width: 12,
      height: 12,
      left: 200,
      top: 0,
      right: 212,
      bottom: 12,
      x: 200,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  ResizeObserverStub.flush();
}

describe('ResizablePanels', () => {
  test('renders one separator between two panes', () => {
    const { container } = render(ResizablePanels, { panes, children: textSnippet });
    mockMeasurements(container);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  test('names the separator from the adjacent pane labels', () => {
    const { container } = render(ResizablePanels, { panes, children: textSnippet });
    mockMeasurements(container);
    const handle = container.querySelector<HTMLElement>('[role="separator"]');
    expect(handle?.getAttribute('aria-label')).toBe('Resize Sidebar and Editor');
  });

  test('horizontal layouts expose a vertical separator orientation', () => {
    const { container } = render(ResizablePanels, {
      panes,
      children: textSnippet,
    });
    mockMeasurements(container);
    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
  });

  test('wires both adjacent panes into aria-controls', () => {
    const { container } = render(ResizablePanels, {
      panes,
      children: textSnippet,
    });
    mockMeasurements(container);
    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    expect(handle.getAttribute('aria-controls')).toContain('sidebar');
    expect(handle.getAttribute('aria-controls')).toContain('editor');
  });
});
