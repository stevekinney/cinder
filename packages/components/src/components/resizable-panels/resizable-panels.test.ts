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
const { createRawSnippet, tick } = await import('svelte');

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

    expect(componentSource).toContain(
      'context.collapsed || (layoutState.availablePanePixels > 0 && context.pixelSize <= 0)',
    );
    expect(componentSource).toContain("aria-hidden={hiddenFromInteraction ? 'true' : undefined}");
    expect(componentSource).toContain('inert={hiddenFromInteraction || undefined}');
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

  test('non-primary pointer buttons do not start a resize drag', async () => {
    const onlayoutchange = mock(() => {});
    const { container } = render(ResizablePanels, { panes, children: textSnippet, onlayoutchange });
    mockMeasurements(container);
    await tick();
    onlayoutchange.mockClear();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    await fireEvent.pointerDown(handle, { pointerId: 1, button: 2, clientX: 200 });
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 260 }));
    await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 260 });

    expect(onlayoutchange).not.toHaveBeenCalled();
  });

  test('ignores a second pointer while a drag is already active', async () => {
    const onlayoutchange = mock(() => {});
    const { container } = render(ResizablePanels, { panes, children: textSnippet, onlayoutchange });
    mockMeasurements(container);
    onlayoutchange.mockClear();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    await fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 200 });
    await fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 240 });
    await tick();
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 260 }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 260 }));

    expect(onlayoutchange).toHaveBeenCalled();
  });

  test('releases pointer capture on the handle that started the drag', async () => {
    const { container } = render(ResizablePanels, { panes, children: textSnippet });
    mockMeasurements(container);
    await tick();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    const releasePointerCapture = mock(() => {});
    handle.setPointerCapture = mock(() => {});
    handle.releasePointerCapture = releasePointerCapture;

    await fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 200 });
    await tick();
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 200 }));

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  test('keyboard resize does not commit when constraints keep the layout fixed', async () => {
    const onlayoutcommit = mock(() => {});
    const constrainedPanes = [
      {
        id: 'sidebar',
        label: 'Sidebar',
        defaultSize: { value: 220, unit: 'px' },
        minSize: { value: 100, unit: 'px' },
        maxSize: { value: 220, unit: 'px' },
      },
      {
        id: 'editor',
        label: 'Editor',
        defaultSize: { value: 380, unit: 'px' },
        minSize: { value: 100, unit: 'px' },
      },
    ] satisfies import('./resizable-panels.types.ts').ResizablePanelDefinition[];
    const { container } = render(ResizablePanels, {
      panes: constrainedPanes,
      children: textSnippet,
      onlayoutcommit,
    });
    mockMeasurements(container, { rootWidth: 612 });
    onlayoutcommit.mockClear();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(onlayoutcommit).not.toHaveBeenCalled();
  });

  test('measurement from zero width does not commit a rebased default layout', async () => {
    const onlayoutcommit = mock(() => {});
    const { container } = render(ResizablePanels, { panes, children: textSnippet, onlayoutcommit });
    mockMeasurements(container, { rootWidth: 12 });
    mockMeasurements(container, { rootWidth: 812 });

    expect(onlayoutcommit).not.toHaveBeenCalled();
  });

  test('snap point metadata changes do not commit when pane pixels stay fixed', async () => {
    const onlayoutcommit = mock(() => {});
    const rendered = render(ResizablePanels, { panes, children: textSnippet, onlayoutcommit });
    mockMeasurements(rendered.container);
    await tick();
    onlayoutcommit.mockClear();

    await rendered.rerender({
      panes: panes.map((pane, index) =>
        index === 0 ? { ...pane, snapPoints: [{ value: 25, unit: 'percent' }] } : pane,
      ),
      children: textSnippet,
      onlayoutcommit,
    });
    await tick();

    expect(onlayoutcommit).not.toHaveBeenCalled();
  });

  test('constrained pointer moves keep the drag anchor current before reversing', async () => {
    const onlayoutchange = mock(
      (_event: import('./resizable-panels.types.ts').ResizablePanelsResizeEvent) => {},
    );
    const constrainedPanes = [
      {
        id: 'sidebar',
        label: 'Sidebar',
        defaultSize: { value: 200, unit: 'px' },
        minSize: { value: 100, unit: 'px' },
        maxSize: { value: 220, unit: 'px' },
      },
      {
        id: 'editor',
        label: 'Editor',
        defaultSize: { value: 400, unit: 'px' },
        minSize: { value: 100, unit: 'px' },
      },
    ] satisfies import('./resizable-panels.types.ts').ResizablePanelDefinition[];
    const { container } = render(ResizablePanels, {
      panes: constrainedPanes,
      children: textSnippet,
      onlayoutchange,
    });
    mockMeasurements(container, { rootWidth: 612 });
    await tick();
    onlayoutchange.mockClear();

    const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
    await fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 200 });
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 220 }));
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 300 }));
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 290 }));

    const lastChange = onlayoutchange.mock.calls.at(-1)?.[0];
    expect(lastChange?.sizes[0]?.size.value).toBeCloseTo(210, 3);
  });

  test('default-collapsed panes remain hidden when measured pane space is zero', async () => {
    const collapsedPanes = [
      { ...panes[0]!, defaultCollapsed: true },
      panes[1]!,
    ] satisfies import('./resizable-panels.types.ts').ResizablePanelDefinition[];
    const { container } = render(ResizablePanels, {
      panes: collapsedPanes,
      children: textSnippet,
    });
    mockMeasurements(container, { rootWidth: 12, handleThickness: 12 });
    await tick();

    const firstPane = container.querySelector<HTMLElement>('.cinder-resizable-panels__pane')!;

    expect(firstPane.getAttribute('data-cinder-collapsed')).toBe('true');
    expect(firstPane.getAttribute('aria-hidden')).toBe('true');
  });

  test('expanded panes remain interactive when measured pane space is zero', async () => {
    const { container } = render(ResizablePanels, {
      panes,
      children: textSnippet,
    });
    mockMeasurements(container, { rootWidth: 12, handleThickness: 12 });
    await tick();

    const renderedPanes = Array.from(
      container.querySelectorAll<HTMLElement>('.cinder-resizable-panels__pane'),
    );

    expect(renderedPanes).toHaveLength(2);
    for (const renderedPane of renderedPanes) {
      expect(renderedPane.getAttribute('data-cinder-collapsed')).toBeNull();
      expect(renderedPane.getAttribute('aria-hidden')).toBeNull();
      expect(renderedPane.hasAttribute('inert')).toBe(false);
    }
  });

  test('orientation changes remeasure on the new axis immediately', async () => {
    const rendered = render(ResizablePanels, {
      panes,
      children: textSnippet,
      orientation: 'horizontal',
    });
    await tick();
    mockMeasurements(rendered.container, { rootWidth: 812, rootHeight: 412, handleThickness: 12 });
    await tick();
    await tick();
    const firstPane = rendered.container.querySelector<HTMLElement>(
      '.cinder-resizable-panels__pane',
    )!;

    expect(firstPane.getAttribute('style')).toContain('200px');

    await rendered.rerender({
      panes,
      children: textSnippet,
      orientation: 'vertical',
    });
    await tick();

    expect(firstPane.getAttribute('style')).toContain('120px');
  });
});
