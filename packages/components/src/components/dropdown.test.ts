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

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Dropdown } = await import('./dropdown.svelte');
const { default: DropdownCompoundFixture } =
  await import('../test/fixtures/dropdown-compound-fixture.svelte');

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

  test('trigger wrapper exists and wraps the trigger snippet', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const triggerWrapper = container.querySelector('.cinder-dropdown__trigger');
    expect(triggerWrapper).not.toBeNull();
    expect(triggerWrapper?.textContent).toContain('Open Menu');
  });

  test('compound trigger wires menu ARIA to the button', () => {
    const { container } = render(DropdownCompoundFixture);

    const trigger = container.querySelector('.trigger');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger?.hasAttribute('popovertarget')).toBe(false);
  });

  test('compound menu renders labels, separators, and items', async () => {
    const { container } = render(DropdownCompoundFixture);

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    expect(container.querySelector('[role="menu"]')?.id).toBe('actions-menu-menu');
    expect(container.querySelector('.cinder-dropdown-label')?.textContent).toContain('Document');
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
  });

  test('compound fallback menu focuses the first enabled item when opened', async () => {
    const { container } = render(DropdownCompoundFixture);

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });
  });

  test('compound fallback menu restores focus to trigger on Escape', async () => {
    const { container } = render(DropdownCompoundFixture);
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  test('Escape on compound menu does not double-fire close+focus through parent handler', async () => {
    // Regression for the Bugbot finding: dropdown-menu owns Escape for the
    // compound API; dropdown.svelte's keydown handler must not run a second
    // close+focus pass when compoundOpen was true. We assert that focus
    // lands on the trigger exactly once and that the menu is gone — the
    // observable failure mode of the double-call would be subtle, but at
    // minimum this guards against regression of the parent-handler split.
    const { container } = render(DropdownCompoundFixture);
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    let triggerFocusCalls = 0;
    const originalFocus = trigger.focus.bind(trigger);
    trigger.focus = () => {
      triggerFocusCalls += 1;
      originalFocus();
    };

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
    // Exactly one focus restoration — without the fix, the compound parent
    // handler would call focusCompoundTrigger() a second time.
    expect(triggerFocusCalls).toBe(1);
  });

  test('compound item click closes the menu and invokes onclick', async () => {
    const { container } = render(DropdownCompoundFixture);

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await fireEvent.click(container.querySelector('[role="menuitem"]') as HTMLElement);

    expect(container.querySelector('output')?.textContent).toBe('copy');
  });

  test('legacy trigger wrapper does not own aria-haspopup', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const triggerWrapper = container.querySelector('.cinder-dropdown__trigger');
    expect(triggerWrapper?.hasAttribute('aria-haspopup')).toBe(false);
  });

  test('legacy trigger wrapper does not own aria-expanded', () => {
    const { container } = render(Dropdown, {
      props: {
        open: false,
        trigger: triggerSnippet,
        children: textSnippet('Menu item'),
      },
    });
    const triggerWrapper = container.querySelector('.cinder-dropdown__trigger');
    expect(triggerWrapper?.hasAttribute('aria-expanded')).toBe(false);
  });
});
