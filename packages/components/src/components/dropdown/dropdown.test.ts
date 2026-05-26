/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
  await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownTriggerNoCaretFixture } =
  await import('../../test/fixtures/dropdown-trigger-no-caret-fixture.svelte');

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

function extractDeclarationBlock(css: string, selector: string): string {
  const selectorStart = css.indexOf(`${selector} {`);
  if (selectorStart === -1) {
    throw new Error(`Could not find selector: ${selector}`);
  }

  const blockStart = css.indexOf('{', selectorStart);
  let depth = 0;

  for (let index = blockStart; index < css.length; index += 1) {
    const character = css[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) {
      return css.slice(blockStart + 1, index);
    }
  }

  throw new Error(`Could not find closing brace for selector: ${selector}`);
}

function expectNoDeclaration(block: string, propertyName: string): void {
  expect(block).not.toMatch(new RegExp(`(^|\\n)\\s*${propertyName}\\s*:`));
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

  test('compound trigger renders a trailing caret by default', () => {
    const { container } = render(DropdownCompoundFixture);

    const caret = container.querySelector('.trigger .cinder-dropdown-trigger__caret');
    expect(caret).not.toBeNull();
    expect(caret?.tagName.toLowerCase()).toBe('svg');
    expect(caret?.getAttribute('aria-hidden')).toBe('true');
    expect(caret?.getAttribute('focusable')).toBe('false');
    expect(caret?.getAttribute('stroke')).toBe('currentColor');
    expect(caret?.getAttribute('stroke-width')).toBe('2');
    expect(caret?.getAttribute('viewBox')).toBe('0 0 20 20');

    const paths = caret?.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths?.[0]?.getAttribute('d')).toBe('M6 8l4 4 4-4');
  });

  test('compound trigger can suppress the automatic caret', () => {
    const { container } = render(DropdownTriggerNoCaretFixture);

    expect(container.querySelector('.trigger .cinder-dropdown-trigger__caret')).toBeNull();
  });

  test('compound trigger caret CSS uses SVG sizing and system spacing', async () => {
    const dropdownCss = await Bun.file(new URL('./dropdown.css', import.meta.url)).text();
    const navigationItemCss = await Bun.file(
      new URL('../navigation-item/navigation-item.css', import.meta.url),
    ).text();

    const triggerBlock = extractDeclarationBlock(dropdownCss, '.cinder-dropdown-trigger');
    const caretBlock = extractDeclarationBlock(dropdownCss, '.cinder-dropdown-trigger__caret');
    const navigationItemBlock = extractDeclarationBlock(
      navigationItemCss,
      '.cinder-navigation-item',
    );

    expect(triggerBlock).toContain('gap: var(--cinder-space-2);');
    expect(navigationItemBlock).toContain('gap: var(--cinder-space-2);');
    expect(caretBlock).toContain('inline-size: 0.75em;');
    expect(caretBlock).toContain('block-size: 0.75em;');

    for (const propertyName of [
      'border-inline-end',
      'border-block-end',
      'border-left',
      'border-right',
      'border-top',
      'border-bottom',
      'rotate',
      'translate',
      'transform',
    ]) {
      expectNoDeclaration(caretBlock, propertyName);
    }
  });

  test('compound menu renders labels, separators, and items', async () => {
    const { container } = render(DropdownCompoundFixture);

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    expect(container.querySelector('[role="menu"]')?.id).toBe('actions-menu-menu');
    expect(container.querySelector('.cinder-dropdown-label')?.textContent).toContain('Document');
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(2);
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
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

  test('Escape with focus on trigger (outside menu) still closes compound menu', async () => {
    // Regression: when focus is on the trigger (e.g. Shift+Tab back from the
    // menu), the menu's onkeydown does not fire because the event path does
    // not traverse the menu element. The parent dropdown's handler must
    // fall back to closeCompoundMenu/focusCompoundTrigger.
    const { container } = render(DropdownCompoundFixture);
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
    });

    // Move focus back to the trigger (the user can do this with Shift+Tab).
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await fireEvent.keyDown(trigger, { key: 'Escape' });

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

  test('grouped menu exposes aria-labelledby boundaries', async () => {
    const { container } = render(DropdownCompoundFixture);

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    const groups = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));
    expect(groups).toHaveLength(2);
    expect(groups[0]?.getAttribute('aria-labelledby')).toBe('actions-menu-document-label');
    expect(container.querySelector('#actions-menu-document-label')?.textContent?.trim()).toBe(
      'Document',
    );
    expect(groups[1]?.getAttribute('aria-labelledby')).toBe('actions-menu-sharing-label');
    expect(container.querySelector('#actions-menu-sharing-label')?.textContent?.trim()).toBe(
      'Sharing',
    );
  });

  test('ArrowDown and ArrowUp move across grouped menu boundaries', async () => {
    const { container } = render(DropdownCompoundFixture);
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Invite people');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toContain('Copy link');
  });

  test('Home and End land on the first and last enabled grouped menu items', async () => {
    const { container } = render(DropdownCompoundFixture);
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement?.textContent).toContain('Archive');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement?.textContent).toContain('Copy link');
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
