/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Alert } = await import('./alert.svelte');

/**
 * Build a minimal Svelte snippet that renders a single text node.
 * `createRawSnippet` is the official Svelte 5 API for constructing snippets
 * outside of `.svelte` files — it satisfies the branded `Snippet<[]>` type.
 */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/** A snippet that renders nothing — satisfies `Snippet<[]>` for tests that only need a slot present. */
const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('Alert rendering', () => {
  test('renders without errors with required props', () => {
    const { container } = render(Alert, {
      props: {
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-alert')).not.toBeNull();
  });

  test('applies custom class prop to root element', () => {
    const { container } = render(Alert, {
      props: {
        class: 'my-custom-class',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-alert');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-alert')).toBe(true);
  });

  test('applies data-cinder-variant for variant "info"', () => {
    const { container } = render(Alert, {
      props: { variant: 'info', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert')?.getAttribute('data-cinder-variant')).toBe(
      'info',
    );
  });

  test('applies data-cinder-variant for variant "success"', () => {
    const { container } = render(Alert, {
      props: { variant: 'success', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert')?.getAttribute('data-cinder-variant')).toBe(
      'success',
    );
  });

  test('applies data-cinder-variant for variant "warning"', () => {
    const { container } = render(Alert, {
      props: { variant: 'warning', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert')?.getAttribute('data-cinder-variant')).toBe(
      'warning',
    );
  });

  test('applies data-cinder-variant for variant "error"', () => {
    const { container } = render(Alert, {
      props: { variant: 'error', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert')?.getAttribute('data-cinder-variant')).toBe(
      'error',
    );
  });

  test('does not render a dismiss button when dismissible is false', () => {
    const { container } = render(Alert, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert__dismiss')).toBeNull();
  });

  test('renders a dismiss button when dismissible is true', () => {
    const { container } = render(Alert, {
      props: { dismissible: true, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert__dismiss')).not.toBeNull();
  });

  test('clicking dismiss button removes the alert from DOM', async () => {
    const { container } = render(Alert, {
      props: { dismissible: true, children: emptySnippet },
    });
    const button = container.querySelector('.cinder-alert__dismiss') as HTMLButtonElement;
    expect(button).not.toBeNull();

    await fireEvent.click(button);

    expect(container.querySelector('.cinder-alert')).toBeNull();
  });

  test('clicking dismiss button calls onDismiss callback', async () => {
    let callCount = 0;
    const { container } = render(Alert, {
      props: {
        dismissible: true,
        onDismiss: () => {
          callCount += 1;
        },
        children: emptySnippet,
      },
    });
    const button = container.querySelector('.cinder-alert__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);

    expect(callCount).toBe(1);
  });

  test('icon snippet renders its content when provided', () => {
    const { container } = render(Alert, {
      props: {
        children: emptySnippet,
        icon: textSnippet('icon-content'),
      },
    });
    expect(container.querySelector('.cinder-alert__icon')).not.toBeNull();
    expect(container.querySelector('.cinder-alert__icon')?.textContent).toContain('icon-content');
  });

  test('icon slot is absent when icon prop is not provided', () => {
    const { container } = render(Alert, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert__icon')).toBeNull();
  });

  test('has role="alert" on root element and does not set an explicit aria-live', () => {
    // role="alert" implies aria-live="assertive" (and aria-atomic="true").
    // Adding aria-live="polite" alongside it would conflict with the implicit
    // assertive value, so the component leaves aria-live unset and lets
    // assistive tech derive it from the role.
    const { container } = render(Alert, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-alert');
    expect(root?.getAttribute('role')).toBe('alert');
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('default variant is "info"', () => {
    const { container } = render(Alert, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-alert')?.getAttribute('data-cinder-variant')).toBe(
      'info',
    );
  });

  test('rest props are spread onto the root element', () => {
    const { container } = render(Alert, {
      props: {
        'data-testid': 'my-alert',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('[data-testid="my-alert"]')).not.toBeNull();
  });

  test('children snippet content is rendered inside the alert', () => {
    const { container } = render(Alert, {
      props: { children: textSnippet('Alert message here') },
    });
    expect(container.querySelector('.cinder-alert__content')?.textContent).toContain(
      'Alert message here',
    );
  });
});
