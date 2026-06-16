/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: GridItem } = await import('./grid-item.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('GridItem', () => {
  test('renders a div by default with cinder-grid-item class', () => {
    const { container } = render(GridItem, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('div.cinder-grid-item');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop', () => {
    const { container } = render(GridItem, {
      props: { as: 'article', children: textSnippet('content') },
    });
    expect(container.querySelector('article.cinder-grid-item')).not.toBeNull();
  });

  test('merges class and forwards rest attributes', () => {
    const { container } = render(GridItem, {
      props: {
        class: 'custom-item',
        'data-testid': 'grid-item',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-grid-item');
    expect(root?.classList.contains('custom-item')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('grid-item');
  });

  test('omits placement custom properties when props are absent', () => {
    const { container } = render(GridItem, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-start')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-end')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-start')).toBe('');
    expect(root.hasAttribute('data-cinder-column-span')).toBe(false);
    expect(root.hasAttribute('data-cinder-row-span')).toBe(false);
  });

  test('threads span into the column span variable and state attribute', () => {
    const { container } = render(GridItem, {
      props: { span: 2, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('2');
    expect(root.getAttribute('data-cinder-column-span')).toBe('true');
  });

  test('threads explicit column placement values', () => {
    const { container } = render(GridItem, {
      props: {
        columnStart: 2,
        columnEnd: 'span 4',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-start')).toBe('2');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-end')).toBe('span 4');
  });

  test('threads row span and row start values', () => {
    const { container } = render(GridItem, {
      props: { rowSpan: 3, rowStart: 2, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('3');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-start')).toBe('2');
    expect(root.getAttribute('data-cinder-row-span')).toBe('true');
  });

  test('flat index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.GridItem).toBe(module.default);
  });
});
