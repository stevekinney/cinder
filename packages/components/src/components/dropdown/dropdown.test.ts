/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

// NOTE: happy-dom does not implement the HTML Popover API (`popover` attribute /
// `showPopover()` / `hidePopover()`). The dropdown component detects popover support
// via `'popover' in HTMLElement.prototype` at module evaluation time. In happy-dom
// this evaluates to false, so the component falls back to the `{#if open}` branch.
// All tests below exercise that fallback path. The popover API path is verified
// through integration tests in a real browser environment.

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');

// Tests render into the shared `document.body` (see the `render` wrapper below).
// Without unmounting between tests, prior renders linger in the DOM and leave
// `document.activeElement` pointing at a torn-down node, so focus assertions
// read another test's markup. `cleanup()` unmounts; `replaceChildren()` clears
// any portal/menu nodes cleanup() doesn't track.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Dropdown } = await import('./dropdown.svelte');
const { default: DropdownCompoundFixture } =
  await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownTriggerNoCaretFixture } =
  await import('../../test/fixtures/dropdown-trigger-no-caret-fixture.svelte');

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Open Menu</button>`,
  setup: () => {},
}));

const dropdownSurfaceProperties = [
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'backgroundColor',
  'color',
  'boxShadow',
] as const;

const deterministicDropdownTokens = `
:root {
  --cinder-border: rgb(44 56 72);
  --cinder-radius-md: 8px;
  --cinder-surface-raised: rgb(242 246 251);
  --cinder-text: rgb(17 24 39);
}

.cinder-dropdown__menu,
.cinder-dropdown-menu {
  --cinder-shadow-overlay: 0 10px 15px rgb(2 6 23 / 0.18);
}
`;

const expectedDropdownSurfaceStyles = {
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'rgb(44 56 72)',
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  borderBottomLeftRadius: '8px',
  borderBottomRightRadius: '8px',
  backgroundColor: 'rgb(242 246 251)',
  color: 'rgb(17 24 39)',
  boxShadow: '0 10px 15px rgb(2 6 23 / 0.18)',
} satisfies Record<(typeof dropdownSurfaceProperties)[number], string>;

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

async function readDropdownCss(): Promise<string> {
  // Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
  // getComputedStyle. The inner declaration blocks are unchanged, so the
  // string-extraction assertions that also use this read are unaffected.
  return stripCinderComponentsLayer(
    await Bun.file(new URL('./dropdown.css', import.meta.url)).text(),
  );
}

async function injectDropdownCss(): Promise<() => void> {
  const [tokens, dropdownCss] = await Promise.all([
    Bun.file(new URL('../../styles/tokens-base.css', import.meta.url)).text(),
    readDropdownCss(),
  ]);

  const style = document.createElement('style');
  style.textContent = `${tokens}\n${dropdownCss}\n${deterministicDropdownTokens}`;
  document.head.appendChild(style);

  return () => style.remove();
}

function readSurfaceStyles(element: HTMLElement) {
  const computedStyle = getComputedStyle(element);
  return Object.fromEntries(
    dropdownSurfaceProperties.map((property) => [property, computedStyle[property]]),
  ) as Record<(typeof dropdownSurfaceProperties)[number], string>;
}

function expectDropdownSurfaceRecipe(styles: ReturnType<typeof readSurfaceStyles>): void {
  for (const property of dropdownSurfaceProperties) {
    expect(styles[property]).toBe(expectedDropdownSurfaceStyles[property]);
  }
}

function renderCompoundDropdown() {
  const result = render(DropdownCompoundFixture);
  return { ...result, container: document.body };
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

  test('compound dropdown reflects an explicit placement prop on the root element', () => {
    const { container } = render(DropdownCompoundFixture, {
      props: { placement: 'top-end' },
    });

    const root = container.querySelector('.cinder-dropdown');
    expect(root?.getAttribute('data-cinder-placement')).toBe('top-end');
  });

  test('compound menu carries placement metadata used by the menu surface', async () => {
    const { container } = render(DropdownCompoundFixture, {
      props: { placement: 'top-end' },
    });

    const trigger = container.querySelector('.trigger');
    expect(trigger).not.toBeNull();
    await fireEvent.click(trigger as Element);

    const menu = document.body.querySelector('.cinder-dropdown-menu');
    expect(menu?.getAttribute('data-cinder-placement')).toBe('top-end');
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

  test('dropdown CSS defines explicit top placement rules for both compound and legacy popover surfaces', async () => {
    const dropdownCss = await Bun.file(new URL('./dropdown.css', import.meta.url)).text();

    expect(dropdownCss).toContain(
      ".cinder-dropdown-menu[popover][data-cinder-placement='top-start']",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown-menu[popover][data-cinder-placement='top-end']",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown[data-cinder-placement='top-start'] .cinder-dropdown__menu[popover]",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown-menu[popover][data-cinder-placement='bottom-start']",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown[data-cinder-placement='top-end'] .cinder-dropdown__menu[popover]",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown[data-cinder-placement='top-start'] .cinder-dropdown__menu:not([popover])",
    );
    expect(dropdownCss).toContain(
      ".cinder-dropdown[data-cinder-placement='top-end'] .cinder-dropdown__menu:not([popover])",
    );
  });

  test('compound trigger wires menu ARIA to the button', () => {
    const { container } = renderCompoundDropdown();

    const trigger = container.querySelector('.trigger');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger?.hasAttribute('popovertarget')).toBe(false);
  });

  test('compound trigger renders a trailing caret by default', () => {
    const { container } = renderCompoundDropdown();

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
    const { container } = renderCompoundDropdown();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    expect(container.querySelector('[role="menu"]')?.id).toBe('actions-menu-menu');
    expect(container.querySelector('.cinder-dropdown-label')?.textContent).toContain('Document');
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(2);
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
  });

  test('compound fallback menu focuses the first enabled item when opened', async () => {
    const { container } = renderCompoundDropdown();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);

    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });
  });

  test('compound fallback menu restores focus to trigger on Escape', async () => {
    const { container } = renderCompoundDropdown();
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
    const { container } = renderCompoundDropdown();
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
    const { container } = renderCompoundDropdown();
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
    const { container } = renderCompoundDropdown();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await fireEvent.click(container.querySelector('[role="menuitem"]') as HTMLElement);

    expect(container.querySelector('output')?.textContent).toBe('copy');
  });

  test('clicking portaled compound menu chrome stays inside the dropdown', async () => {
    const { container } = renderCompoundDropdown();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => {
      expect(document.body.querySelector('#actions-menu-menu')).not.toBeNull();
    });

    await fireEvent.click(document.body.querySelector('.cinder-dropdown-label') as HTMLElement);

    expect(document.body.querySelector('#actions-menu-menu')).not.toBeNull();
  });

  test('grouped menu exposes aria-labelledby boundaries', async () => {
    const { container } = renderCompoundDropdown();

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
    const { container } = renderCompoundDropdown();
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
    const { container } = renderCompoundDropdown();
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

  test('ArrowUp from the first item wraps to the last item', async () => {
    const { container } = renderCompoundDropdown();
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toContain('Archive');
  });

  test('ArrowDown from the last item wraps to the first item', async () => {
    const { container } = renderCompoundDropdown();
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement?.textContent).toContain('Archive');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Copy link');
  });

  test('Enter activates the focused menu item and closes the menu', async () => {
    const { container } = renderCompoundDropdown();
    const trigger = container.querySelector('.trigger') as HTMLElement;

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('Copy link');
    });

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Invite people');

    // In a real browser, pressing Enter on a focused <button> dispatches a native
    // click, which drives activation + close-on-select. DropdownItem no longer
    // synthesizes its own click on keydown (that caused double-activation), and
    // happy-dom does not synthesize the native click from keydown — so we fire
    // the click directly on the focused item to exercise the same native path.
    await fireEvent.click(document.activeElement as HTMLElement);

    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeNull();
    });
    expect(container.querySelector('output')?.textContent).toBe('share');
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

  test('placement and component menus compute the same surface styles', async () => {
    const removeStyles = await injectDropdownCss();
    let legacyContainer: HTMLElement | null = null;
    let componentContainer: HTMLElement | null = null;

    try {
      const legacyDropdown = render(Dropdown, {
        props: {
          open: true,
          trigger: triggerSnippet,
          children: textSnippet('Placement API item'),
        },
      });
      legacyContainer = legacyDropdown.container;

      const placementMenu = legacyDropdown.container.querySelector(
        '.cinder-dropdown__menu',
      ) as HTMLElement;
      expect(placementMenu).not.toBeNull();
      document.body.appendChild(legacyDropdown.container);

      const placementStyles = readSurfaceStyles(placementMenu);
      expectDropdownSurfaceRecipe(placementStyles);

      const componentDropdown = render(DropdownCompoundFixture);
      componentContainer = componentDropdown.container;
      document.body.appendChild(componentDropdown.container);
      await fireEvent.click(componentDropdown.container.querySelector('.trigger') as HTMLElement);

      const componentMenu = document.body.querySelector(
        '#actions-menu-menu.cinder-dropdown-menu',
      ) as HTMLElement;
      expect(componentMenu).not.toBeNull();

      const componentStyles = readSurfaceStyles(componentMenu);

      // The real token sheet is loaded first, then these tests provide
      // deterministic token values because happy-dom does not compute
      // light-dark() colors into longhands. That keeps this as a rendered
      // regression guard instead of a hollow equality check.
      expectDropdownSurfaceRecipe(componentStyles);

      for (const property of dropdownSurfaceProperties) {
        expect(componentStyles[property]).toBe(placementStyles[property]);
      }
    } finally {
      legacyContainer?.remove();
      componentContainer?.remove();
      removeStyles();
    }
  });

  test('both menu selectors share one declared surface recipe', async () => {
    const css = await readDropdownCss();
    expect(css).toMatch(/\.cinder-dropdown__menu,\s*\.cinder-dropdown-menu\s*\{/);
    expect(css).toContain('background: var(--cinder-surface-raised);');
    expect(css).toContain('box-shadow: var(--cinder-shadow-overlay);');
    expect(css).not.toContain('--cinder-dropdown-menu-shadow:');
    expect(css).not.toContain('oklch(100% 0 0 / 0.11)');
    expect(css).not.toContain('oklch(100% 0 0 / 0.07)');
    expect(css).not.toContain('border-radius: var(--cinder-radius-lg);');
    expect(css).not.toContain('color-mix(in oklch, var(--cinder-text) 8%');
  });

  test('fixed-position fallback clears legacy absolute insets', async () => {
    const css = await readDropdownCss();
    expect(css).toMatch(
      /\.cinder-dropdown-menu\[data-cinder-position-ready\]\s*\{[^}]*inset:\s*auto;/,
    );
  });

  test('popover dropdown menu preserves start/end anchoring in RTL', async () => {
    const css = await readDropdownCss();
    expect(css).toMatch(
      /\.cinder-dropdown-menu\[popover\]\s*\{[^}]*inset-inline-end:\s*anchor\(right\);[^}]*inset-inline-start:\s*auto;/,
    );
    expect(css).toMatch(
      /\.cinder-dropdown-menu\[popover\]\[data-cinder-placement='bottom-start'\]\s*\{[^}]*inset-inline-start:\s*anchor\(left\);[^}]*inset-inline-end:\s*auto;/,
    );
    expect(css).toMatch(
      /\.cinder-dropdown-menu\[popover\]\[dir='rtl'\]\[data-cinder-placement='bottom-start'\],\s*\.cinder-dropdown-menu\[popover\]\[dir='rtl'\]\[data-cinder-placement='top-start'\]\s*\{[^}]*inset-inline-end:\s*anchor\(right\);[^}]*inset-inline-start:\s*auto;/,
    );
    expect(css).toMatch(
      /\.cinder-dropdown-menu\[popover\]\[dir='rtl'\]\[data-cinder-placement='bottom-end'\],\s*\.cinder-dropdown-menu\[popover\]\[dir='rtl'\]\[data-cinder-placement='top-end'\]\s*\{[^}]*inset-inline-start:\s*anchor\(left\);[^}]*inset-inline-end:\s*auto;/,
    );
  });
});
