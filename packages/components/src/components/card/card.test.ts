/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
  test('renders a basic card without a generated header', () => {
    const { container } = render(Card, {
      props: {
        children: textSnippet('basic-card-body'),
      },
    });
    const root = container.querySelector('.cinder-card');
    expect(root).not.toBeNull();
    expect(container.querySelector('.cinder-card__header')).toBeNull();
    expect(container.querySelector('.cinder-card__body')?.textContent).toContain('basic-card-body');
  });

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

  test('variant prop is reflected on the root element', () => {
    const { container } = render(Card, {
      props: {
        variant: 'well',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card')?.getAttribute('data-cinder-variant')).toBe(
      'well',
    );
  });

  test('danger tone is reflected on the container and adds a non-color title cue', () => {
    const { container, getByRole, getByText } = render(Card, {
      props: {
        tone: 'danger',
        title: 'Pause reviews',
        description: 'Stops new review dispatch globally.',
        role: 'region',
        'aria-labelledby': 'consumer-heading',
        'aria-describedby': 'external-warning',
        children: textSnippet('Existing runs continue.'),
      } as any,
    });

    const root = container.querySelector('.cinder-card');
    const heading = getByRole('heading', { name: 'Pause reviews' });
    const description = getByText('Stops new review dispatch globally.');

    expect(root?.getAttribute('data-cinder-tone')).toBe('danger');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-labelledby')).toBe('consumer-heading');
    expect(root?.getAttribute('aria-describedby')).toBe(
      `${description.getAttribute('id')} external-warning`,
    );
    expect(heading).not.toBeNull();
    expect(description).not.toBeNull();
    expect(root?.querySelector('.cinder-card__risk-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  test('generated descriptions normalize caller aria-describedby tokens', () => {
    const { container, getByText } = render(Card, {
      props: {
        title: 'Risk setting',
        description: 'Review this before continuing.',
        'aria-describedby': '  external-warning   external-warning  ',
        children: emptySnippet,
      } as any,
    });

    const root = container.querySelector('.cinder-card');
    const description = getByText('Review this before continuing.');

    expect(root?.getAttribute('role')).toBe('group');
    expect(root?.getAttribute('aria-describedby')).toBe(
      `${description.getAttribute('id')} external-warning`,
    );
  });

  test('danger tone preserves custom header ownership', () => {
    const { container } = render(Card, {
      props: {
        tone: 'danger',
        title: 'Generated title should not render',
        description: 'Generated description should not render.',
        header: textSnippet('custom-danger-header'),
        role: 'region',
        children: emptySnippet,
      } as any,
    });

    const root = container.querySelector('.cinder-card');
    expect(root?.getAttribute('data-cinder-tone')).toBe('danger');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.hasAttribute('aria-labelledby')).toBe(false);
    expect(root?.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('.cinder-card__risk-icon')).toBeNull();
    expect(container.querySelector('.cinder-card__title')).toBeNull();
    expect(container.querySelector('.cinder-card__header')?.textContent).toContain(
      'custom-danger-header',
    );
  });

  test('bodyTone and footerTone props are reflected on their regions', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
        bodyTone: 'muted',
        footerTone: 'muted',
        footer: textSnippet('footer-content'),
      },
    });

    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-tone')).toBe(
      'muted',
    );
    expect(container.querySelector('.cinder-card__footer')?.getAttribute('data-cinder-tone')).toBe(
      'muted',
    );
  });

  test('edgeToEdgeOnMobile prop is reflected only when enabled', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
        edgeToEdgeOnMobile: true,
      },
    });
    expect(
      container.querySelector('.cinder-card')?.hasAttribute('data-cinder-edge-to-edge-mobile'),
    ).toBe(true);
  });

  test('padding prop is reflected as data-cinder-padding on the body element', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
        padding: 'none',
      },
    });
    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-padding')).toBe(
      'none',
    );
  });

  test('padding defaults to "default" when not provided', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-padding')).toBe(
      'default',
    );
  });
});

describe('Card CSS contract', () => {
  test('title uses the primary text token', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const titleBlock = css.match(/\.cinder-card__title\s*\{[^}]*\}/)?.[0] ?? '';
    expect(titleBlock).toContain('color: var(--cinder-text)');
    expect(titleBlock).not.toContain('color: var(--cinder-text-muted)');
  });

  test('danger tone paints the container surface, border, and icon', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const dangerBlock =
      css.match(/\.cinder-card\[data-cinder-tone='danger'\]\s*\{[^}]*\}/)?.[0] ?? '';
    const iconBlock = css.match(/\.cinder-card__risk-icon\s*\{[^}]*\}/)?.[0] ?? '';

    expect(dangerBlock).toContain('background');
    expect(dangerBlock).toContain('border-color');
    expect(dangerBlock).toContain('var(--cinder-color-danger-bg)');
    expect(dangerBlock).toContain('var(--cinder-color-danger-border)');
    expect(iconBlock).toContain('var(--cinder-danger)');
  });
});
