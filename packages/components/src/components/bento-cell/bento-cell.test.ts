/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: BentoCell } = await import('./bento-cell.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('BentoCell', () => {
  test('renders a div by default with cinder-bento-cell class', () => {
    const { container } = render(BentoCell, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('div.cinder-bento-cell');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop', () => {
    const { container } = render(BentoCell, {
      props: { as: 'article', children: textSnippet('content') },
    });
    expect(container.querySelector('article.cinder-bento-cell')).not.toBeNull();
  });

  test('merges class and forwards rest attributes', () => {
    const { container } = render(BentoCell, {
      props: {
        class: 'custom-bento-cell',
        'data-testid': 'bento-cell',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-bento-cell');
    expect(root?.classList.contains('custom-bento-cell')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('bento-cell');
  });

  test('omits placement custom properties when props are absent', () => {
    const { container } = render(BentoCell, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-cell') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-cell-col-span')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-span')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-cell-column-start')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-cell-column-end')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-start')).toBe('');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-end')).toBe('');
    expect(root.hasAttribute('data-cinder-col-span')).toBe(false);
    expect(root.hasAttribute('data-cinder-row-span')).toBe(false);
  });

  test('threads colSpan and rowSpan into CSS variables', () => {
    const { container } = render(BentoCell, {
      props: { colSpan: 2, rowSpan: 3, children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-bento-cell') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-cell-col-span')).toBe('2');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-span')).toBe('3');
    expect(root.getAttribute('data-cinder-col-span')).toBe('true');
    expect(root.getAttribute('data-cinder-row-span')).toBe('true');
  });

  test('explicit column and row end values win over span state', () => {
    const { container } = render(BentoCell, {
      props: {
        colSpan: 2,
        rowSpan: 3,
        columnEnd: 'span 1',
        rowEnd: 4,
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-bento-cell') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-cell-column-end')).toBe('span 1');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-end')).toBe('4');
    expect(root.hasAttribute('data-cinder-col-span')).toBe(false);
    expect(root.hasAttribute('data-cinder-row-span')).toBe(false);
  });

  test('threads explicit track start values', () => {
    const { container } = render(BentoCell, {
      props: {
        columnStart: 2,
        rowStart: 3,
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-bento-cell') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-bento-cell-column-start')).toBe('2');
    expect(root.style.getPropertyValue('--cinder-bento-cell-row-start')).toBe('3');
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.BentoCell).toBe(module.default);
  });
});
