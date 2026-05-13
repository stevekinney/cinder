/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: StackedListItem } = await import('./stacked-list-item.svelte');

/** Build a minimal Svelte snippet that renders a single text node. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('StackedListItem', () => {
  test('renders all snippets under their respective class names', () => {
    const { container } = render(StackedListItem, {
      props: {
        leading: textSnippet('leading-content'),
        title: textSnippet('title-content'),
        description: textSnippet('description-content'),
        meta: textSnippet('meta-content'),
        trailing: textSnippet('trailing-content'),
      },
    });

    const root = container.querySelector('.cinder-stacked-list-item');
    expect(root).not.toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__leading')?.textContent).toContain(
      'leading-content',
    );
    expect(root?.querySelector('.cinder-stacked-list-item__title')?.textContent).toContain(
      'title-content',
    );
    expect(root?.querySelector('.cinder-stacked-list-item__description')?.textContent).toContain(
      'description-content',
    );
    expect(root?.querySelector('.cinder-stacked-list-item__meta')?.textContent).toContain(
      'meta-content',
    );
    expect(root?.querySelector('.cinder-stacked-list-item__trailing')?.textContent).toContain(
      'trailing-content',
    );
    // Modifier classes are set when snippets are present
    expect(root?.classList.contains('cinder-stacked-list-item--has-leading')).toBe(true);
    expect(root?.classList.contains('cinder-stacked-list-item--has-trailing')).toBe(true);
  });

  test('title-only minimal case omits optional sub-elements', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('only-title'),
      },
    });

    const root = container.querySelector('.cinder-stacked-list-item');
    expect(root).not.toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__leading')).toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__description')).toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__meta')).toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__trailing')).toBeNull();
    expect(root?.querySelector('.cinder-stacked-list-item__title')?.textContent).toContain(
      'only-title',
    );
    // Modifier classes are absent when snippets are omitted
    expect(root?.classList.contains('cinder-stacked-list-item--has-leading')).toBe(false);
    expect(root?.classList.contains('cinder-stacked-list-item--has-trailing')).toBe(false);
  });

  test('href renders title as <a>', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('linked-title'),
        href: '/some/path',
      },
    });

    const root = container.querySelector('.cinder-stacked-list-item');
    expect(root?.tagName).toBe('LI');

    const anchor = root?.querySelector('.cinder-stacked-list-item__title-link');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/some/path');
    expect(anchor?.textContent).toContain('linked-title');
  });

  test('no href renders title without anchor', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('static-title'),
      },
    });

    const titleEl = container.querySelector('.cinder-stacked-list-item__title');
    expect(titleEl?.querySelector('.cinder-stacked-list-item__title-link')).toBeNull();
    expect(titleEl?.textContent).toContain('static-title');
  });

  test('target, rel, and hreflang are forwarded onto the anchor', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('external'),
        href: 'https://example.com',
        target: '_blank',
        rel: 'noopener noreferrer',
        hreflang: 'en',
      },
    });

    const anchor = container.querySelector('.cinder-stacked-list-item__title-link');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('hreflang')).toBe('en');

    // Anchor attributes must not leak onto the <li>
    const li = container.querySelector('.cinder-stacked-list-item');
    expect(li?.getAttribute('target')).toBeNull();
    expect(li?.getAttribute('rel')).toBeNull();
    expect(li?.getAttribute('hreflang')).toBeNull();
  });

  test('target="_blank" without rel auto-applies rel="noopener noreferrer"', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('external'),
        href: 'https://example.com',
        target: '_blank',
      },
    });

    const anchor = container.querySelector('.cinder-stacked-list-item__title-link');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.getAttribute('target')).toBe('_blank');
  });

  test('defaults to comfortable density', () => {
    const { container } = render(StackedListItem, {
      props: { title: textSnippet('t') },
    });

    expect(
      container.querySelector('.cinder-stacked-list-item')?.getAttribute('data-cinder-density'),
    ).toBe('comfortable');
  });

  test('condensed density sets data-cinder-density="condensed"', () => {
    const { container } = render(StackedListItem, {
      props: { title: textSnippet('t'), density: 'condensed' },
    });

    expect(
      container.querySelector('.cinder-stacked-list-item')?.getAttribute('data-cinder-density'),
    ).toBe('condensed');
  });

  test('<li> has no role or tabindex — not interactive', () => {
    const { container } = render(StackedListItem, {
      props: { title: textSnippet('no-handlers') },
    });

    const li = container.querySelector('.cinder-stacked-list-item');
    expect(li?.getAttribute('role')).toBeNull();
    expect(li?.getAttribute('tabindex')).toBeNull();
  });

  test('data-*, id, and aria-* attrs land on the <li>, not an anchor', () => {
    const { container } = render(StackedListItem, {
      props: {
        title: textSnippet('spread-test'),
        'data-row-id': '42',
        'aria-labelledby': 'x',
        id: 'row-42',
      } as any,
    });

    const li = container.querySelector('.cinder-stacked-list-item');
    expect(li?.getAttribute('data-row-id')).toBe('42');
    expect(li?.getAttribute('aria-labelledby')).toBe('x');
    expect(li?.getAttribute('id')).toBe('row-42');

    // Confirm href/target/rel/hreflang are not on the <li>
    expect(li?.getAttribute('href')).toBeNull();
    expect(li?.getAttribute('target')).toBeNull();
    expect(li?.getAttribute('rel')).toBeNull();
    expect(li?.getAttribute('hreflang')).toBeNull();
  });

  test('custom class is merged with cinder-stacked-list-item', () => {
    const { container } = render(StackedListItem, {
      props: { title: textSnippet('t'), class: 'my-row' },
    });

    const li = container.querySelector('.cinder-stacked-list-item');
    expect(li?.classList.contains('cinder-stacked-list-item')).toBe(true);
    expect(li?.classList.contains('my-row')).toBe(true);
  });
});
