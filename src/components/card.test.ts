/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Card } = await import('./card.svelte');

/** Build a minimal Svelte snippet that renders a single text node. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/** A snippet that renders nothing — satisfies Snippet<[]> for tests that only need a slot present. */
const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('Card', () => {
  test('renders with title + description arm', () => {
    const { container } = render(Card, {
      props: {
        title: 'Card Title',
        description: 'Card description text',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-card');
    expect(root).not.toBeNull();
    expect(root?.querySelector('.cinder-card__title')?.textContent).toBe('Card Title');
    expect(root?.querySelector('.cinder-card__description')?.textContent).toBe(
      'Card description text',
    );
  });

  test('renders with header snippet arm', () => {
    const { container } = render(Card, {
      props: {
        header: textSnippet('custom-header'),
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-card');
    expect(root).not.toBeNull();
    const headerEl = root?.querySelector('.cinder-card__header');
    expect(headerEl).not.toBeNull();
    expect(headerEl?.textContent).toContain('custom-header');
    // title element should not be present when header snippet is used
    expect(root?.querySelector('.cinder-card__title')).toBeNull();
  });

  test('applies class prop alongside cinder-card', () => {
    const { container } = render(Card, {
      props: {
        title: 'Test',
        children: emptySnippet,
        class: 'my-custom-class',
      },
    });
    const root = container.querySelector('.cinder-card');
    expect(root?.classList.contains('cinder-card')).toBe(true);
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  test('footer snippet renders when provided', () => {
    const { container } = render(Card, {
      props: {
        title: 'Test',
        children: emptySnippet,
        footer: textSnippet('footer-content'),
      },
    });
    const footerEl = container.querySelector('.cinder-card__footer');
    expect(footerEl).not.toBeNull();
    expect(footerEl?.textContent).toContain('footer-content');
  });

  test('footer is absent when not provided', () => {
    const { container } = render(Card, {
      props: {
        title: 'Test',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__footer')).toBeNull();
  });

  test('children snippet content renders inside the card body', () => {
    const { container } = render(Card, {
      props: {
        title: 'Test',
        children: textSnippet('body-content'),
      },
    });
    const body = container.querySelector('.cinder-card__body');
    expect(body).not.toBeNull();
    expect(body?.textContent).toContain('body-content');
  });

  test('rest props are applied to the root element', () => {
    const { container } = render(Card, {
      props: {
        title: 'Test',
        children: emptySnippet,
        'data-testid': 'my-card',
      },
    });
    expect(container.querySelector('[data-testid="my-card"]')).not.toBeNull();
  });

  test('description is absent when not provided in title arm', () => {
    const { container } = render(Card, {
      props: {
        title: 'No description',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__description')).toBeNull();
  });

  test('no header element rendered when neither header snippet nor title is provided', () => {
    const { container } = render(Card, {
      props: {
        // TypeScript would reject this, but JS-land test verifies runtime guard
        children: emptySnippet,
      } as any,
    });
    expect(container.querySelector('.cinder-card__header')).toBeNull();
  });
});
