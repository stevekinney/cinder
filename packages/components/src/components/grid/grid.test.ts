/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
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
