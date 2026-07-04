/// <reference lib="dom" />
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: BentoGrid } = await import('./bento-grid.svelte');
const { createRawSnippet, tick } = await import('svelte');

class CapturingResizeObserver implements ResizeObserver {
  static instances: CapturingResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;
  observed: Element | undefined;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    CapturingResizeObserver.instances.push(this);
  }

  observe(target: Element, _options?: ResizeObserverOptions): void {
    this.observed = target;
  }

  unobserve(_target: Element): void {}

  disconnect(): void {}

  trigger(width: number): void {
    this.callback(
      [
        {
          borderBoxSize: [{ inlineSize: width }],
          contentRect: { width },
          target: this.observed,
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: CapturingResizeObserver,
    writable: true,
  });
});

beforeEach(() => {
  CapturingResizeObserver.instances = [];
});

afterAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: originalResizeObserver,
    writable: true,
  });
});

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('BentoGrid', () => {
  test('renders a div by default with cinder-bento-grid class', () => {
    const { container } = render(BentoGrid, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('div.cinder-bento-grid');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop', () => {
    const { container } = render(BentoGrid, {
      props: { as: 'section', children: textSnippet('content') },
    });
    expect(container.querySelector('section.cinder-bento-grid')).not.toBeNull();
  });

  test('merges class and forwards rest attributes', () => {
    const { container } = render(BentoGrid, {
      props: {
        class: 'custom-bento-grid',
        'data-testid': 'bento-grid',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-bento-grid');
    expect(root?.classList.contains('custom-bento-grid')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('bento-grid');
  });

  test('keeps the as element as the public grid element', () => {
    const { container } = render(BentoGrid, {
      props: {
        as: 'ul',
        style: 'align-items: start;',
        children: createRawSnippet(() => ({
          render: () => '<li class="cinder-bento-cell">Feature</li>',
        })),
      },
    });

    const root = container.querySelector('ul.cinder-bento-grid') as HTMLElement;
    expect(root).not.toBeNull();
    expect([...root.children].every((child) => child.tagName === 'LI')).toBe(true);
    expect(root.style.alignItems).toBe('start');
  });

  test('marks narrow grids from the public grid element width', async () => {
    const { container } = render(BentoGrid, {
      props: { children: textSnippet('content') },
    });
    await tick();

    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    const observer = CapturingResizeObserver.instances[0];
    expect(observer?.observed).toBe(root);
    expect(root.hasAttribute('data-cinder-wide')).toBe(false);

    observer?.trigger(640);
    await tick();
    expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
    expect(root.hasAttribute('data-cinder-wide')).toBe(false);

    observer?.trigger(1024);
    await tick();
    expect(root.hasAttribute('data-cinder-narrow')).toBe(false);
    expect(root.hasAttribute('data-cinder-wide')).toBe(true);
  });

  test('measures the public grid element before the first resize observer callback', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        width: 640,
        height: 0,
        top: 0,
        right: 640,
        bottom: 0,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    try {
      const { container } = render(BentoGrid, {
        props: { children: textSnippet('content') },
      });
      await tick();

      const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
      expect(root.hasAttribute('data-cinder-narrow')).toBe(true);
      expect(root.hasAttribute('data-cinder-wide')).toBe(false);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test('omits inline custom properties when layout props are absent', () => {
    const { container } = render(BentoGrid, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-columns')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-grid-row-gap')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-grid-column-gap')).toBe('');
    expect(root.hasAttribute('data-cinder-collapse')).toBe(true);
  });

  test('threads numeric columns as a repeat expression', () => {
    const { container } = render(BentoGrid, {
      props: { columns: 4, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-columns')).toBe(
      'repeat(4, minmax(0, 1fr))',
    );
  });

  test('threads string columns verbatim', () => {
    const { container } = render(BentoGrid, {
      props: { columns: '18rem minmax(0, 1fr)', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-columns')).toBe('18rem minmax(0, 1fr)');
  });

  test('ignores invalid numeric column counts', () => {
    const { container } = render(BentoGrid, {
      props: { columns: 0, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-columns')).toBe('');
  });

  test('threads gap to both row and column gap', () => {
    const { container } = render(BentoGrid, {
      props: { gap: '1rem', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-row-gap')).toBe('1rem');
    expect(root.style.getPropertyValue('--cinder-bento-grid-column-gap')).toBe('1rem');
  });

  test('rowGap and columnGap override the uniform gap independently', () => {
    const { container } = render(BentoGrid, {
      props: {
        gap: '1rem',
        rowGap: '1.5rem',
        columnGap: '2rem',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-grid-row-gap')).toBe('1.5rem');
    expect(root.style.getPropertyValue('--cinder-bento-grid-column-gap')).toBe('2rem');
  });

  test('collapse can be disabled', () => {
    const { container } = render(BentoGrid, {
      props: { collapse: false, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-grid') as HTMLElement;
    expect(root.hasAttribute('data-cinder-collapse')).toBe(false);
  });

  test('namespace export exposes BentoGrid.Cell while flat export remains importable', async () => {
    const [{ default: BentoGridIndex, BentoGrid: NamedBentoGrid }, { default: BentoCell }] =
      await Promise.all([import('./index.ts'), import('../bento-cell/index.ts')]);

    expect(BentoGridIndex).toBe(NamedBentoGrid);
    expect(BentoGridIndex.Cell).toBe(BentoCell);
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(typeof module.default.Cell).toBe('function');
  });

  test('collapse CSS uses measured narrow state without a viewport media query', () => {
    const css = readFileSync(new URL('./bento-grid.css', import.meta.url), 'utf8');
    expect(css).toContain('[data-cinder-collapse][data-cinder-narrow]');
    expect(css).toContain('> .cinder-bento-cell');
    expect(css).not.toMatch(/@media[^{]*(?:min-width|max-width)/);
  });
});
