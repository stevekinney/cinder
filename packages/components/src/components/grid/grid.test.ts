/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Grid } = await import('./grid.svelte');

afterEach(cleanup);

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

// Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
// getComputedStyle or expose them as top-level CSSStyleRules.
const gridCss = stripCinderComponentsLayer(
  await Bun.file(new URL('./grid.css', import.meta.url)).text(),
);

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

  test('establishes an inline-size container instead of a JS ResizeObserver', () => {
    // happy-dom's CSS parser does not recognize `container-type`/
    // `container-name` and drops the entire `.cinder-grid` rule block when
    // they are present — verified via `getComputedStyle` (every property on
    // the rule, including unrelated ones like `display`, reads back as
    // happy-dom's default rather than the declared value) and via the
    // parsed CSSOM (`.cinder-grid` is absent from `sheet.cssRules`
    // entirely, while sibling rules without these properties parse fine).
    // Neither technique can observe the declaration in this environment, so
    // assert on the source text instead, scoped to the `.cinder-grid` rule
    // block specifically so this doesn't just match the string anywhere in
    // the file.
    const ruleStart = gridCss.indexOf('.cinder-grid {');
    const ruleEnd = gridCss.indexOf('}', ruleStart);
    expect(ruleStart).toBeGreaterThan(-1);
    const cinderGridRule = gridCss.slice(ruleStart, ruleEnd);
    expect(cinderGridRule).toContain('container-type: inline-size;');
    expect(cinderGridRule).toContain('container-name: cinder-grid;');
  });

  test('data-cinder-collapse reflects narrowCollapseEnabled', () => {
    const enabled = render(Grid, {
      props: { narrowCollapseEnabled: true, children: textSnippet('content') },
    });
    expect(
      enabled.container.querySelector('.cinder-grid')?.hasAttribute('data-cinder-collapse'),
    ).toBe(true);
    enabled.unmount();

    const disabled = render(Grid, {
      props: { narrowCollapseEnabled: false, children: textSnippet('content') },
    });
    expect(
      disabled.container.querySelector('.cinder-grid')?.hasAttribute('data-cinder-collapse'),
    ).toBe(false);
    disabled.unmount();
  });

  test('never constructs a ResizeObserver or MutationObserver (#1186 row 10)', () => {
    const resizeObserverSpy = spyOn(globalThis, 'ResizeObserver');
    const mutationObserverSpy = spyOn(globalThis, 'MutationObserver');

    try {
      const { unmount } = render(Grid, {
        props: { narrowCollapseEnabled: true, children: textSnippet('content') },
      });
      expect(resizeObserverSpy).toHaveBeenCalledTimes(0);
      expect(mutationObserverSpy).toHaveBeenCalledTimes(0);

      unmount();
      expect(resizeObserverSpy).toHaveBeenCalledTimes(0);
      expect(mutationObserverSpy).toHaveBeenCalledTimes(0);
    } finally {
      resizeObserverSpy.mockRestore();
      mutationObserverSpy.mockRestore();
    }
  });

  test('spans every direct child across the full row at the container breakpoint', () => {
    // A query container excludes itself when resolving which container a
    // rule queries, so `.cinder-grid[data-cinder-collapse] { grid-template-
    // columns: 1fr; }` inside this @container block would never apply (self
    // is not a valid ancestor of self). The collapse rule instead targets
    // every direct child with `grid-column: 1 / -1`, which stacks them into
    // a single visual column without needing to reassign
    // grid-template-columns on the container itself.
    expect(gridCss).toContain('@container cinder-grid (max-width: 48rem)');
    expect(gridCss).toContain('.cinder-grid[data-cinder-collapse] > * {');
    expect(gridCss).toContain('grid-column: 1 / -1;');
    expect(gridCss).toContain('grid-row: auto;');
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
