/// <reference lib="dom" />
import { describe, expect, spyOn, test } from 'bun:test';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { createRawSnippet, tick } = await import('svelte');
const { default: Grid } = await import('./grid.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Grid', () => {
  test('renders a div by default with cinder-grid class', () => {
    const { container } = render(Grid, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('div.cinder-grid');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop', () => {
    const { container } = render(Grid, {
      props: { as: 'section', children: textSnippet('content') },
    });
    expect(container.querySelector('section.cinder-grid')).not.toBeNull();
  });

  test('merges class and forwards rest attributes', () => {
    const { container } = render(Grid, {
      props: {
        class: 'custom-grid',
        'data-testid': 'grid',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-grid');
    expect(root?.classList.contains('custom-grid')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('grid');
  });

  test('measures narrow-collapse-enabled grids on mount', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 640, height: 0 }) as DOMRect;

    try {
      const { container } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-collapse')).toBe(true);
      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      expect(root.hasAttribute('data-cinder-wide')).toBe(false);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test('measures when narrow collapse is enabled after mount', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 640, height: 0 }) as DOMRect;

    try {
      const { container, rerender } = render(Grid, {
        props: { narrowCollapseEnabled: false, children: textSnippet('content') },
      });
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-narrow')).toBe(false);

      await rerender({ narrowCollapseEnabled: true, children: textSnippet('content') });
      await tick();
      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      expect(root.hasAttribute('data-cinder-wide')).toBe(false);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test('uses physical width when resize entries report logical dimensions', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let resizeCallback: ResizeObserverCallback | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 675, height: 240 }) as DOMRect;
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      root.style.writingMode = 'vertical-rl';

      resizeCallback?.(
        [
          {
            target: root,
            borderBoxSize: [{ inlineSize: 320, blockSize: 900 }],
            contentBoxSize: [{ inlineSize: 320, blockSize: 900 }],
            devicePixelContentBoxSize: [],
            contentRect: { width: 900, height: 320 } as DOMRectReadOnly,
          },
        ],
        {} as ResizeObserver,
      );
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(false);
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);
      unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('uses the untransformed border-box width from resize entries', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let resizeCallback: ResizeObserverCallback | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 675, height: 240 }) as DOMRect;
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;

      resizeCallback?.(
        [
          {
            target: root,
            borderBoxSize: [{ inlineSize: 900, blockSize: 320 }],
            contentBoxSize: [{ inlineSize: 900, blockSize: 320 }],
            devicePixelContentBoxSize: [],
            contentRect: { width: 900, height: 320 } as DOMRectReadOnly,
          },
        ],
        {} as ResizeObserver,
      );
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(false);
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);
      unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('uses the element border box when resize entries omit borderBoxSize', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let resizeCallback: ResizeObserverCallback | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 675, height: 240 }) as DOMRect;
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      Object.defineProperty(root, 'offsetWidth', { configurable: true, value: 900 });

      resizeCallback?.(
        [
          {
            target: root,
            borderBoxSize: [],
            contentBoxSize: [{ inlineSize: 675, blockSize: 240 }],
            devicePixelContentBoxSize: [],
            contentRect: { width: 675, height: 240 } as DOMRectReadOnly,
          },
        ],
        {} as ResizeObserver,
      );
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(false);
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);
      unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('treats a zero-width resize observation as narrow', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let resizeCallback: ResizeObserverCallback | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 900, height: 240 }) as DOMRect;
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      resizeCallback?.(
        [
          {
            target: root,
            borderBoxSize: [{ inlineSize: 0, blockSize: 240 }],
            contentBoxSize: [{ inlineSize: 0, blockSize: 240 }],
            devicePixelContentBoxSize: [],
            contentRect: { width: 0, height: 240 } as DOMRectReadOnly,
          },
        ],
        {} as ResizeObserver,
      );
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      expect(root.hasAttribute('data-cinder-wide')).toBe(false);
      unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('observes inserted stylesheets when ResizeObserver is unavailable', async () => {
    const originalGetComputedStyle = globalThis.getComputedStyle;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let rootFontSize = 16;
    let stylesheet: HTMLStyleElement | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 800, height: 320 }) as DOMRect;
    globalThis.getComputedStyle = ((element: Element, pseudoElement?: string | null) => {
      const style = originalGetComputedStyle(element, pseudoElement);
      if (element !== document.documentElement) return style;

      return new Proxy(style, {
        get(target, property, receiver) {
          if (property === 'fontSize') return `${rootFontSize}px`;
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as typeof getComputedStyle;
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      rootFontSize = 18;
      stylesheet = document.createElement('style');
      stylesheet.textContent = ':root { font-size: 18px; }';
      document.head.append(stylesheet);
      await waitFor(() => expect(root.hasAttribute('data-cinder-narrow')).toBe(true));
      unmount();
    } finally {
      stylesheet?.remove();
      globalThis.getComputedStyle = originalGetComputedStyle;
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('recomputes after an external stylesheet loads when ResizeObserver is unavailable', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = globalThis.ResizeObserver;
    let width = 900;
    let stylesheet: HTMLLinkElement | undefined;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width, height: 320 }) as DOMRect;
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      const removeEventListener = spyOn(stylesheet, 'removeEventListener');
      document.head.append(stylesheet);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      width = 600;
      stylesheet.dispatchEvent(new Event('load'));
      await waitFor(() => expect(root.hasAttribute('data-cinder-narrow')).toBe(true));

      stylesheet.remove();
      await waitFor(() =>
        expect(removeEventListener).toHaveBeenCalledWith('load', expect.any(Function)),
      );
      unmount();
    } finally {
      stylesheet?.remove();
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('observes a rem-sized probe for stylesheet-driven root font changes', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    );
    const originalResizeObserver = globalThis.ResizeObserver;
    const observers: Array<{ callback: ResizeObserverCallback; targets: Element[] }> = [];
    let rootFontSize = 16;

    HTMLElement.prototype.getBoundingClientRect = () => ({ width: 800, height: 0 }) as DOMRect;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.hasAttribute('data-cinder-grid-threshold-probe') ? 48 * rootFontSize : 800;
      },
    });
    globalThis.ResizeObserver = class implements ResizeObserver {
      private readonly record: { callback: ResizeObserverCallback; targets: Element[] };

      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, targets: [] };
        observers.push(this.record);
      }

      observe(target: Element) {
        this.record.targets.push(target);
      }

      unobserve() {}
      disconnect() {}
    };

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      const probeObserver = observers.find((observer) =>
        observer.targets.some((target) => target.hasAttribute('data-cinder-grid-threshold-probe')),
      );
      const probe = probeObserver?.targets.find((target) =>
        target.hasAttribute('data-cinder-grid-threshold-probe'),
      ) as HTMLElement;
      expect(probe).toBeDefined();
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      rootFontSize = 18;
      probeObserver?.callback([], {} as ResizeObserver);
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      unmount();
      expect(probe.isConnected).toBe(false);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
      }
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('does not register the window resize fallback when ResizeObserver is available', async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const addEventListener = spyOn(window, 'addEventListener');

    globalThis.ResizeObserver = class implements ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();

      expect(addEventListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0);
      unmount();
    } finally {
      addEventListener.mockRestore();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test('remeasures on window resize when observers are unavailable', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalMutationObserver = globalThis.MutationObserver;
    const originalResizeObserver = globalThis.ResizeObserver;
    let width = 900;
    HTMLElement.prototype.getBoundingClientRect = () => ({ width, height: 0 }) as DOMRect;
    globalThis.MutationObserver = undefined as unknown as typeof MutationObserver;
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    try {
      const { container, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      await tick();
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-wide')).toBe(true);

      width = 640;
      window.dispatchEvent(new Event('resize'));
      await tick();

      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.MutationObserver = originalMutationObserver;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  test("uses the Grid element's document for thresholds and resize fallback", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalMutationObserver = globalThis.MutationObserver;
    const originalResizeObserver = globalThis.ResizeObserver;
    const secondaryWindow = new Window();
    const secondaryDocument = secondaryWindow.document as unknown as Document;
    const hostAddEventListener = spyOn(window, 'addEventListener');
    const secondaryAddEventListener = spyOn(secondaryWindow, 'addEventListener');
    let width = 800;

    secondaryWindow.document.documentElement.style.fontSize = '20px';
    HTMLElement.prototype.getBoundingClientRect = () => ({ width, height: 320 }) as DOMRect;
    globalThis.MutationObserver = undefined as unknown as typeof MutationObserver;
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    try {
      const { container, rerender, unmount } = render(Grid, {
        props: { narrowCollapseEnabled: false, children: textSnippet('content') },
      });
      const root = container.querySelector('.cinder-grid') as HTMLElement;
      Object.defineProperty(root, 'ownerDocument', {
        configurable: true,
        value: secondaryDocument,
      });

      await rerender({ narrowCollapseEnabled: true, children: textSnippet('content') });
      await tick();

      expect(root.ownerDocument).toBe(secondaryDocument);
      expect(
        secondaryWindow.getComputedStyle(secondaryWindow.document.documentElement).fontSize,
      ).toBe('20px');
      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      expect(hostAddEventListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0);
      expect(
        secondaryAddEventListener.mock.calls.filter(([type]) => type === 'resize'),
      ).toHaveLength(1);

      width = 1_000;
      secondaryWindow.dispatchEvent(new secondaryWindow.Event('resize'));
      await tick();

      expect(root.hasAttribute('data-cinder-wide')).toBe(true);
      unmount();
    } finally {
      hostAddEventListener.mockRestore();
      secondaryAddEventListener.mockRestore();
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      globalThis.MutationObserver = originalMutationObserver;
      globalThis.ResizeObserver = originalResizeObserver;
      await secondaryWindow.happyDOM.close();
    }
  });

  test('resets direct Grid.Item placement in the narrow state', () => {
    const stylesheet = readFileSync(new URL('./grid.css', import.meta.url), 'utf8');
    expect(stylesheet).toContain(
      '.cinder-grid[data-cinder-collapse][data-cinder-narrow] > .cinder-grid-item',
    );
    expect(stylesheet).toContain('grid-column-start: auto;');
    expect(stylesheet).toContain('grid-column-end: auto;');
  });

  test('does not measure ordinary grids', () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    let measurements = 0;
    HTMLElement.prototype.getBoundingClientRect = function () {
      measurements += 1;
      return originalGetBoundingClientRect.call(this);
    };

    try {
      render(Grid, { props: { children: textSnippet('content') } });
      expect(measurements).toBe(0);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test('omits inline custom properties when layout props are absent', () => {
    const { container } = render(Grid, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-columns')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-row-gap')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-column-gap')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('');
  });

  test('threads numeric columns as a repeat expression', () => {
    const { container } = render(Grid, {
      props: { columns: 3, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-columns')).toBe('repeat(3, 1fr)');
  });

  test('ignores invalid numeric column counts', () => {
    const { container } = render(Grid, {
      props: { columns: 0, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-columns')).toBe('');
  });

  test('threads string columns verbatim', () => {
    const { container } = render(Grid, {
      props: { columns: '12rem minmax(0, 1fr)', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-columns')).toBe('12rem minmax(0, 1fr)');
  });

  test('threads gap to both row and column gap', () => {
    const { container } = render(Grid, {
      props: { gap: '1rem', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-row-gap')).toBe('1rem');
    expect(root.style.getPropertyValue('--cinder-grid-column-gap')).toBe('1rem');
  });

  test('rowGap and columnGap override the uniform gap independently', () => {
    const { container } = render(Grid, {
      props: {
        gap: '1rem',
        rowGap: '2rem',
        columnGap: '3rem',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-row-gap')).toBe('2rem');
    expect(root.style.getPropertyValue('--cinder-grid-column-gap')).toBe('3rem');
  });

  test('minItemWidth threads width and takes precedence over columns', () => {
    const { container } = render(Grid, {
      props: { columns: 4, minItemWidth: '16rem', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('16rem');
    expect(root.style.getPropertyValue('--cinder-grid-columns')).toBe(
      'repeat(auto-fill, minmax(min(var(--cinder-grid-min-item-width), 100%), 1fr))',
    );
  });

  test('namespace export exposes Grid.Item while flat export remains importable', async () => {
    const [{ default: GridIndex, Grid: NamedGrid }, { default: GridItem }] = await Promise.all([
      import('./index.ts'),
      import('../grid-item/index.ts'),
    ]);

    expect(GridIndex).toBe(NamedGrid);
    expect(GridIndex.Item).toBe(GridItem);
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(typeof module.default.Item).toBe('function');
  });
});
