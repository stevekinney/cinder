/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

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

const { cleanup, fireEvent, render } = await import('@testing-library/svelte/pure');
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

function mockMeasurements(
  container: HTMLElement,
  {
    rootWidth = 800,
    rootHeight = 400,
    handleOffset = 200,
    handleThickness = 12,
  }: {
    rootWidth?: number;
    rootHeight?: number;
    handleOffset?: number;
    handleThickness?: number;
  } = {},
): void {
  const root = container.querySelector<HTMLElement>('.cinder-resizable-panels');
  const handle = container.querySelector<HTMLElement>('.cinder-resizable-panels__handle');
  root!.getBoundingClientRect = () =>
    ({
      width: rootWidth,
      height: rootHeight,
      left: 0,
      top: 0,
      right: rootWidth,
      bottom: rootHeight,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  handle!.getBoundingClientRect = () =>
    ({
      width: handleThickness,
      height: handleThickness,
      left: handleOffset,
      top: 0,
      right: handleOffset + handleThickness,
      bottom: handleThickness,
      x: handleOffset,
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

  test('fallback separator aria uses the adjacent pane pair before measurement', () => {
    const { container } = render(ResizablePanels, { panes, children: textSnippet });
    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;

    expect(handle.getAttribute('aria-valuenow')).toBe('50');
    expect(handle.getAttribute('aria-valuetext')).toBe('50% (0px)');
  });

  test('collapsed panes clip and hide their children from focus navigation', async () => {
    const componentSource = await Bun.file(
      new URL('./resizable-panels.svelte', import.meta.url),
    ).text();
    const styleSheet = await Bun.file(new URL('./resizable-panels.css', import.meta.url)).text();

    expect(componentSource).toContain("aria-hidden={context.collapsed ? 'true' : undefined}");
    expect(componentSource).toContain('inert={context.collapsed || undefined}');
    expect(styleSheet).toContain('.cinder-resizable-panels__pane[data-cinder-collapsed]');
    expect(styleSheet).toContain('overflow: hidden');
  });

  test('pointer release does not commit without a size change', async () => {
    const onlayoutcommit = mock(() => {});
    const { container } = render(ResizablePanels, { panes, children: textSnippet, onlayoutcommit });
    mockMeasurements(container);
    onlayoutcommit.mockClear();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200 });
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 200 });

    expect(onlayoutcommit).not.toHaveBeenCalled();
  });
});
