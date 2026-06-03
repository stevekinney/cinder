/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: FloatingActionButton } = await import('./floating-action-button.svelte');
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders an icon-like span. */
function iconSnippet(label: string = 'icon') {
  return createRawSnippet(() => ({
    render: () => `<span aria-hidden="true">${label}</span>`,
  }));
}

afterEach(() => {
  cleanup();
});

describe('FloatingActionButton — element rendering', () => {
  test('renders a <button> when no href is provided', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add item', children: iconSnippet() },
    });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('renders an <a> when href is provided', () => {
    const { container } = render(FloatingActionButton, {
      props: { href: '/new', 'aria-label': 'Create', children: iconSnippet() },
    });
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('button always has type="button"', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });

  test('applies .cinder-fab class', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('.cinder-fab')).not.toBeNull();
  });

  test('custom class merges with .cinder-fab', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', class: 'my-custom', children: iconSnippet() },
    });
    const element = container.querySelector('.cinder-fab');
    expect(element?.classList.contains('cinder-fab')).toBe(true);
    expect(element?.classList.contains('my-custom')).toBe(true);
  });
});

describe('FloatingActionButton — data attributes', () => {
  test('applies default variant "filled"', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-variant')).toBe(
      'filled',
    );
  });

  test('applies default size "md"', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-size')).toBe('md');
  });

  test('applies default color "primary"', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-color')).toBe(
      'primary',
    );
  });

  test('every variant renders its data attribute', () => {
    for (const variant of ['filled', 'extended'] as const) {
      const { container, unmount } = render(FloatingActionButton, {
        props: { variant, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-variant')).toBe(
        variant,
      );
      unmount();
    }
  });

  test('every size renders its data attribute', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { container, unmount } = render(FloatingActionButton, {
        props: { size, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-size')).toBe(size);
      unmount();
    }
  });

  test('every color renders its data attribute', () => {
    for (const color of ['primary', 'secondary', 'surface'] as const) {
      const { container, unmount } = render(FloatingActionButton, {
        props: { color, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(container.querySelector('.cinder-fab')?.getAttribute('data-cinder-color')).toBe(color);
      unmount();
    }
  });
});

describe('FloatingActionButton — disabled state', () => {
  test('disabled button has disabled attribute', () => {
    const { container } = render(FloatingActionButton, {
      props: { disabled: true, 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  });

  test('non-disabled button does not have disabled attribute', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(false);
  });

  test('disabled link renders aria-disabled="true"', () => {
    const { container } = render(FloatingActionButton, {
      props: { href: '/new', disabled: true, 'aria-label': 'Create', children: iconSnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('aria-disabled')).toBe('true');
  });

  test('disabled link withholds href and is removed from the tab order', () => {
    // A disabled <a> has no native disabled state; aria-disabled alone is advisory and
    // the link would still navigate. So the href is dropped and tabindex=-1 is forced.
    const { container } = render(FloatingActionButton, {
      props: { href: '/new', disabled: true, 'aria-label': 'Create', children: iconSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
  });

  test('enabled link keeps its href and is focusable', () => {
    const { container } = render(FloatingActionButton, {
      props: { href: '/new', 'aria-label': 'Create', children: iconSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/new');
    expect(anchor?.hasAttribute('tabindex')).toBe(false);
  });
});

describe('FloatingActionButton — accessible name', () => {
  test('aria-label is applied to the button', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Compose message', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Compose message');
  });

  test('aria-label is applied to the anchor', () => {
    const { container } = render(FloatingActionButton, {
      props: { href: '/compose', 'aria-label': 'Compose message', children: iconSnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBe('Compose message');
  });

  test('empty aria-label is omitted from DOM', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': '   ', children: iconSnippet() },
    });
    // Whitespace-only label normalizes to undefined — attribute must not be present
    expect(container.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
  });

  test('aria-labelledby is applied', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-labelledby': 'fab-label', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('aria-labelledby')).toBe('fab-label');
  });

  test('component-controlled aria-label cannot be clobbered via rest spread', () => {
    // The component spreads rest BEFORE setting aria-label, so the prop value wins.
    const { container } = render(FloatingActionButton, {
      props: {
        'aria-label': 'Correct label',
        // Passing the same attribute again via rest would try to clobber.
        children: iconSnippet(),
      },
    });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Correct label');
  });
});

describe('FloatingActionButton — native attribute passthrough', () => {
  test('forwards data-testid to the button', () => {
    const { container } = render(FloatingActionButton, {
      props: { 'aria-label': 'Add', 'data-testid': 'fab-button', children: iconSnippet() },
    });
    expect(container.querySelector('[data-testid="fab-button"]')).not.toBeNull();
  });

  test('forwards data-testid to the anchor', () => {
    const { container } = render(FloatingActionButton, {
      props: {
        href: '/target',
        'aria-label': 'Go',
        'data-testid': 'fab-link',
        children: iconSnippet(),
      },
    });
    expect(container.querySelector('[data-testid="fab-link"]')).not.toBeNull();
  });

  test('forwards id to the rendered element', () => {
    const { container } = render(FloatingActionButton, {
      props: { id: 'my-fab', 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('#my-fab')).not.toBeNull();
  });
});

describe('FloatingActionButton — children rendering', () => {
  test('renders children inside the button', () => {
    const { container } = render(FloatingActionButton, {
      props: {
        'aria-label': 'Add',
        children: createRawSnippet(() => ({
          render: () => `<span class="test-icon">+</span>`,
        })),
      },
    });
    expect(container.querySelector('.test-icon')).not.toBeNull();
    expect(container.querySelector('.test-icon')?.textContent).toBe('+');
  });

  test('renders children inside the anchor', () => {
    const { container } = render(FloatingActionButton, {
      props: {
        href: '/add',
        'aria-label': 'Add',
        children: createRawSnippet(() => ({
          render: () => `<span class="test-icon">+</span>`,
        })),
      },
    });
    expect(container.querySelector('.test-icon')).not.toBeNull();
  });
});
