/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: GridItem } = await import('./grid-item.svelte');
const { default: NestedGridItemFixture } =
  await import('../../test/fixtures/nested-grid-item-fixture.svelte');

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
    // --cinder-grid-item-row-end is always declared explicitly (see the
    // nested-leak test below), so its "absent" state is a literal 'auto'
    // rather than an unset property.
    expect(root.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('auto');
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

  test('preserves explicit column start while applying span through column end', () => {
    const { container } = render(GridItem, {
      props: { span: 2, columnStart: 3, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-start')).toBe('3');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('2');
    expect(root.getAttribute('data-cinder-column-span')).toBe('true');
  });

  test('explicit column end wins over span state', () => {
    const { container } = render(GridItem, {
      props: { span: 2, columnEnd: 5, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('2');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-end')).toBe('5');
    expect(root.hasAttribute('data-cinder-column-span')).toBe(false);
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

  test('threads explicit rowEnd values', () => {
    const { container } = render(GridItem, {
      props: { rowEnd: 'span 4', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('span 4');
  });

  test('explicit rowEnd wins over rowSpan state', () => {
    const { container } = render(GridItem, {
      props: { rowSpan: 2, rowEnd: 5, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('2');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('5');
    expect(root.hasAttribute('data-cinder-row-span')).toBe(false);
  });

  test('normalizes an empty-string rowEnd to undefined, leaving rowSpan applied', () => {
    const { container } = render(GridItem, {
      props: { rowSpan: 2, rowEnd: '', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('auto');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('2');
    expect(root.getAttribute('data-cinder-row-span')).toBe('true');
  });

  test('normalizes invalid numeric rowEnd (0, non-integer) to undefined, leaving rowSpan applied', () => {
    const zeroCase = render(GridItem, {
      props: { rowSpan: 2, rowEnd: 0, children: textSnippet('content') },
    });
    const zeroRoot = zeroCase.container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(zeroRoot.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('auto');
    expect(zeroRoot.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('2');
    expect(zeroRoot.getAttribute('data-cinder-row-span')).toBe('true');
    zeroCase.unmount();

    const fractionalCase = render(GridItem, {
      props: { rowSpan: 2, rowEnd: 1.5, children: textSnippet('content') },
    });
    const fractionalRoot = fractionalCase.container.querySelector(
      '.cinder-grid-item',
    ) as HTMLElement;
    expect(fractionalRoot.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('auto');
    expect(fractionalRoot.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('2');
    expect(fractionalRoot.getAttribute('data-cinder-row-span')).toBe('true');
  });

  test('normalizes invalid numeric columnStart/columnEnd/rowStart to undefined', () => {
    const { container } = render(GridItem, {
      props: {
        columnStart: 0,
        columnEnd: 1.5,
        rowStart: 0,
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-start')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-column-end')).toBe('');
    expect(root.style.getPropertyValue('--cinder-grid-item-row-start')).toBe('');
  });

  test('normalizes an invalid span (empty string, 0, non-integer) to undefined, falling back to auto-placement', () => {
    for (const invalidSpan of ['', 0, 1.5] as const) {
      const { container, unmount } = render(GridItem, {
        props: { span: invalidSpan, children: textSnippet('content') },
      });
      const root = container.querySelector('.cinder-grid-item') as HTMLElement;
      expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('');
      expect(root.hasAttribute('data-cinder-column-span')).toBe(false);
      unmount();
    }
  });

  test('applies a valid span of 2', () => {
    const { container } = render(GridItem, {
      props: { span: 2, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-column-span')).toBe('2');
    expect(root.getAttribute('data-cinder-column-span')).toBe('true');
  });

  test('normalizes an invalid rowSpan (empty string, 0, non-integer) to undefined', () => {
    for (const invalidRowSpan of ['', 0, 1.5] as const) {
      const { container, unmount } = render(GridItem, {
        props: { rowSpan: invalidRowSpan, children: textSnippet('content') },
      });
      const root = container.querySelector('.cinder-grid-item') as HTMLElement;
      expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('');
      expect(root.hasAttribute('data-cinder-row-span')).toBe(false);
      unmount();
    }
  });

  test('applies a valid rowSpan of 2', () => {
    const { container } = render(GridItem, {
      props: { rowSpan: 2, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-grid-item') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-grid-item-row-span')).toBe('2');
    expect(root.getAttribute('data-cinder-row-span')).toBe('true');
  });

  test('does not leak an outer rowEnd custom property into a nested Grid.Item that omits it', () => {
    const { container } = render(NestedGridItemFixture, {
      props: { outerRowEnd: 'span 3' },
    });
    const outer = container.querySelector<HTMLElement>('[data-testid="outer-item"]');
    const inner = container.querySelector<HTMLElement>('[data-testid="inner-item"]');
    expect(outer?.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('span 3');
    // The inner item declares its own 'auto' locally rather than omitting the
    // property, so it can never resolve to the outer item's inherited value.
    expect(inner?.style.getPropertyValue('--cinder-grid-item-row-end')).toBe('auto');
  });

  test('flat index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.GridItem).toBe(module.default);
  });
});
