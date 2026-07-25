/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: FloatingAction } = await import('./floating-action.svelte');
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

describe('FloatingAction — element rendering', () => {
  test('renders a <button> when no href is provided', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add item', children: iconSnippet() },
    });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('renders an <a> when href is provided', () => {
    const { container } = render(FloatingAction, {
      props: { href: '/new', 'aria-label': 'Create', children: iconSnippet() },
    });
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('button always has type="button"', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });

  test('applies .cinder-floating-action class', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('.cinder-floating-action')).not.toBeNull();
  });

  test('custom class merges with .cinder-floating-action', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', class: 'my-custom', children: iconSnippet() },
    });
    const element = container.querySelector('.cinder-floating-action');
    expect(element?.classList.contains('cinder-floating-action')).toBe(true);
    expect(element?.classList.contains('my-custom')).toBe(true);
  });
});

describe('FloatingAction — data attributes', () => {
  test('applies default shape "filled"', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(
      container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-shape'),
    ).toBe('filled');
  });

  test('applies default size "md"', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(
      container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-size'),
    ).toBe('md');
  });

  test('applies default variant "primary"', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(
      container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-variant'),
    ).toBe('primary');
  });

  test('every shape renders its data attribute', () => {
    for (const shape of ['filled', 'extended'] as const) {
      const { container, unmount } = render(FloatingAction, {
        props: { shape, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(
        container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-shape'),
      ).toBe(shape);
      unmount();
    }
  });

  test('every size renders its data attribute', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { container, unmount } = render(FloatingAction, {
        props: { size, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(
        container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-size'),
      ).toBe(size);
      unmount();
    }
  });

  test('every variant renders its data attribute', () => {
    for (const variant of ['primary', 'secondary', 'surface'] as const) {
      const { container, unmount } = render(FloatingAction, {
        props: { variant, 'aria-label': 'Add', children: iconSnippet() },
      });
      expect(
        container.querySelector('.cinder-floating-action')?.getAttribute('data-cinder-variant'),
      ).toBe(variant);
      unmount();
    }
  });
});

describe('FloatingAction — secondary surface states', () => {
  test('derives hover and pressed feedback from the raised resting fill', () => {
    const source = readFileSync(new URL('./floating-action.css', import.meta.url), 'utf8');
    expect(source).toMatch(
      /data-cinder-variant='secondary'\]:hover[\s\S]*?background:\s*var\(--cinder-surface-raised-hover\)/,
    );
    expect(source).toMatch(
      /data-cinder-variant='secondary'\]:active[\s\S]*?background:\s*var\(--cinder-surface-raised-pressed\)/,
    );
  });
});

describe('FloatingAction — disabled state', () => {
  test('disabled button has disabled attribute', () => {
    const { container } = render(FloatingAction, {
      props: { disabled: true, 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  });

  test('non-disabled button does not have disabled attribute', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.hasAttribute('disabled')).toBe(false);
  });

  test('disabled link renders aria-disabled="true"', () => {
    const { container } = render(FloatingAction, {
      props: { href: '/new', disabled: true, 'aria-label': 'Create', children: iconSnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('aria-disabled')).toBe('true');
  });

  test('disabled link withholds href and is removed from the tab order', () => {
    // A disabled <a> has no native disabled state; aria-disabled alone is advisory and
    // the link would still navigate. So the href is dropped and tabindex=-1 is forced.
    const { container } = render(FloatingAction, {
      props: { href: '/new', disabled: true, 'aria-label': 'Create', children: iconSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
  });

  test('enabled link keeps its href and is focusable', () => {
    const { container } = render(FloatingAction, {
      props: { href: '/new', 'aria-label': 'Create', children: iconSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/new');
    expect(anchor?.hasAttribute('tabindex')).toBe(false);
  });

  test('enabled link honors a consumer-supplied tabindex', () => {
    const { container } = render(FloatingAction, {
      props: { href: '/new', tabindex: 0, 'aria-label': 'Create', children: iconSnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('0');
  });

  test('disabled link does not fire a consumer onclick handler', async () => {
    // pointer-events:none + tabindex=-1 block the usual paths, but a consumer onclick in
    // rest would still fire on programmatic/keyboard activation — so it's withheld when disabled.
    let fired = 0;
    const { container } = render(FloatingAction, {
      props: {
        href: '/new',
        disabled: true,
        onclick: () => (fired += 1),
        'aria-label': 'Create',
        children: iconSnippet(),
      },
    });
    const anchor = container.querySelector('a') as HTMLElement;
    await fireEvent.click(anchor);
    expect(fired).toBe(0);
  });

  test('enabled link fires the consumer onclick handler', async () => {
    let fired = 0;
    const { container } = render(FloatingAction, {
      props: {
        href: '/new',
        onclick: () => (fired += 1),
        'aria-label': 'Create',
        children: iconSnippet(),
      },
    });
    await fireEvent.click(container.querySelector('a') as HTMLElement);
    expect(fired).toBe(1);
  });
});

describe('FloatingAction — accessible name', () => {
  test('aria-label is applied to the button', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': 'Compose message', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Compose message');
  });

  test('aria-label is applied to the anchor', () => {
    const { container } = render(FloatingAction, {
      props: { href: '/compose', 'aria-label': 'Compose message', children: iconSnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBe('Compose message');
  });

  test('empty aria-label is omitted from DOM', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-label': '   ', children: iconSnippet() },
    });
    // Whitespace-only label normalizes to undefined — attribute must not be present
    expect(container.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
  });

  test('aria-labelledby is applied', () => {
    const { container } = render(FloatingAction, {
      props: { 'aria-labelledby': 'floating-action-label', children: iconSnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('aria-labelledby')).toBe(
      'floating-action-label',
    );
  });

  test('aria-label is taken from the named prop, not from rest', () => {
    // aria-label is a destructured named prop (never part of rest), and it's the only
    // way to set the attribute — a JS props object can't pass it a second time. This
    // confirms the named prop drives the rendered aria-label.
    const { container } = render(FloatingAction, {
      props: {
        'aria-label': 'Correct label',
        children: iconSnippet(),
      },
    });
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Correct label');
  });
});

describe('FloatingAction — native attribute passthrough', () => {
  test('forwards data-testid to the button', () => {
    const { container } = render(FloatingAction, {
      props: {
        'aria-label': 'Add',
        'data-testid': 'floating-action-button',
        children: iconSnippet(),
      },
    });
    expect(container.querySelector('[data-testid="floating-action-button"]')).not.toBeNull();
  });

  test('forwards data-testid to the anchor', () => {
    const { container } = render(FloatingAction, {
      props: {
        href: '/target',
        'aria-label': 'Go',
        'data-testid': 'floating-action-link',
        children: iconSnippet(),
      },
    });
    expect(container.querySelector('[data-testid="floating-action-link"]')).not.toBeNull();
  });

  test('forwards id to the rendered element', () => {
    const { container } = render(FloatingAction, {
      props: { id: 'my-floating-action', 'aria-label': 'Add', children: iconSnippet() },
    });
    expect(container.querySelector('#my-floating-action')).not.toBeNull();
  });
});

describe('FloatingAction — children rendering', () => {
  test('renders children inside the button', () => {
    const { container } = render(FloatingAction, {
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
    const { container } = render(FloatingAction, {
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
