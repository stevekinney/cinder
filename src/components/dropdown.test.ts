/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

// NOTE: happy-dom does not implement the HTML Popover API (`popover` attribute /
// `showPopover()` / `hidePopover()`). The dropdown component detects popover support
// via `'popover' in HTMLElement.prototype` at module evaluation time. In happy-dom
// this evaluates to false, so the component falls back to the `{#if open}` branch.
// All tests below exercise that fallback path. The popover API path is verified
// through integration tests in a real browser environment.

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Dropdown } = await import('./dropdown.svelte');

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Open Menu</button>`,
  setup: () => {},
}));

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('Dropdown', () => {
  test('trigger renders', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    expect(container.querySelector('.cinder-dropdown__trigger')).not.toBeNull();
    expect(container.textContent).toContain('Open Menu');
  });

  test('menu is absent when open=false', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    // In the fallback (non-popover) branch the menu element is conditionally rendered.
    // It should be absent when open is false.
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  test('menu renders when open=true', () => {
    const { container } = render(Dropdown, {
      props: {
        open: true,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
  });

  test('menu has role="menu"', () => {
    const { container } = render(Dropdown, {
      props: {
        open: true,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const menu = container.querySelector('.cinder-dropdown__menu');
    expect(menu?.getAttribute('role')).toBe('menu');
  });

  test('Escape key on root element closes the dropdown', async () => {
    let openValue = true;
    const { container } = render(Dropdown, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });

    const root = container.querySelector('.cinder-dropdown') as HTMLElement;
    expect(root).not.toBeNull();
    await fireEvent.keyDown(root, { key: 'Escape' });
    expect(openValue).toBe(false);
  });

  test('data-cinder-placement reflects placement prop on root element', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        placement: 'bottom-end',
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const root = container.querySelector('.cinder-dropdown');
    expect(root?.getAttribute('data-cinder-placement')).toBe('bottom-end');
  });

  test('defaults to placement "bottom-start"', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const root = container.querySelector('.cinder-dropdown');
    expect(root?.getAttribute('data-cinder-placement')).toBe('bottom-start');
  });

  test('menu children content is rendered when open', () => {
    const { container } = render(Dropdown, {
      props: {
        open: true,
        trigger: triggerSnippet,
        children: textSnippet('My menu item'),
      },
    });
    const menu = container.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain('My menu item');
  });
});
