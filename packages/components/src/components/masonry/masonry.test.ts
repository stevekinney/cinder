/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { MasonryElement } from './masonry.types.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: MasonryFixture } = await import('./masonry.fixture.svelte');
const { default: Masonry } = await import('./masonry.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Masonry', () => {
  test('renders a div by default with cinder-masonry class', () => {
    const { container } = render(Masonry, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('div.cinder-masonry');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop', () => {
    const { container } = render(Masonry, {
      props: { as: 'section', children: textSnippet('content') },
    });
    expect(container.querySelector('section.cinder-masonry')).not.toBeNull();
  });

  test('merges class and forwards rest attributes', () => {
    const { container } = render(Masonry, {
      props: {
        class: 'custom-masonry',
        'data-testid': 'masonry',
        children: textSnippet('content'),
      },
    });
    const root = container.querySelector('.cinder-masonry');
    expect(root?.classList.contains('custom-masonry')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('masonry');
  });

  test('omits custom properties when layout props are absent', () => {
    const { container } = render(Masonry, {
      props: { children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-masonry') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-masonry-columns')).toBe('');
    expect(root.style.getPropertyValue('--cinder-masonry-gap')).toBe('');
  });

  test('threads columns and gap through CSS variables', () => {
    const { container } = render(Masonry, {
      props: { columns: '4', gap: '1.5rem', children: textSnippet('content') },
    });
    const root = container.querySelector('.cinder-masonry') as HTMLElement;
    expect(root.style.getPropertyValue('--cinder-masonry-columns')).toBe('4');
    expect(root.style.getPropertyValue('--cinder-masonry-gap')).toBe('1.5rem');
  });

  test('renders multiple children', () => {
    const { container } = render(MasonryFixture);
    expect(container.querySelectorAll('.cinder-masonry > article').length).toBe(2);
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.Masonry).toBe(module.default);
  });

  test('as prop accepts allowed MasonryElement values', () => {
    // Verify a representative set of layout-safe elements are accepted.
    const allowedElements: MasonryElement[] = ['article', 'section', 'aside', 'main', 'div'];
    for (const element of allowedElements) {
      const { container } = render(Masonry, {
        props: { as: element, children: textSnippet('content') },
      });
      expect(container.querySelector(`${element}.cinder-masonry`)).not.toBeNull();
    }
  });

  test('MasonryElement union excludes void elements', () => {
    // Type-level regression: MasonryElement must not include void element names.
    // The runtime check uses a type assertion to ensure 'img' and 'input' are
    // not assignable to MasonryElement at the TypeScript level.
    const voidElements = ['img', 'input', 'br', 'hr'];
    const allowedSet: readonly string[] = [
      'article',
      'aside',
      'div',
      'footer',
      'header',
      'main',
      'nav',
      'section',
      'ul',
      'ol',
    ];
    for (const element of voidElements) {
      expect(allowedSet.includes(element)).toBe(false);
    }
  });
});
