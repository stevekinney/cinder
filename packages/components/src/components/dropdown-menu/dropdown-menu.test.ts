/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const dropdownMenuSource = readFileSync(new URL('./dropdown-menu.svelte', import.meta.url), 'utf8');

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownDirectionFixture } =
  await import('../../test/fixtures/dropdown-direction-fixture.svelte');
const { default: DropdownMenu } = await import('./dropdown-menu.svelte');
const { pushEscapeHandler, _resetEscapeStack } = await import('../../_internal/overlay.ts');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  _resetEscapeStack();
});

function renderFixture(props?: { menuStyle?: string; triggerStyle?: string }) {
  const result = render(Fixture, props ? { props } : undefined);
  return { ...result, container: document.body };
}

describe('DropdownMenu', () => {
  test('throws when rendered outside a Dropdown', () => {
    expect(() =>
      render(DropdownMenu, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span></span>', setup: () => {} })),
        },
      }),
    ).toThrow(/missing_context/);
  });

  test('is absent until the trigger opens it, then renders with role="menu"', async () => {
    const { container } = renderFixture();
    expect(container.querySelector('[role="menu"]')).toBeNull();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());
    expect(container.querySelector('[role="menu"]')?.id).toBe('actions-menu-menu');
  });

  test('ArrowDown moves focus to the next menu item once open', async () => {
    const { container } = renderFixture();
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Invite people');
  });

  test('printable keys move focus to the next matching menu item', async () => {
    const { container } = renderFixture();
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'i' });
    expect(document.activeElement?.textContent).toContain('Invite people');

    await Bun.sleep(550);
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'a' });
    expect(document.activeElement?.textContent).toContain('Archive');
  });

  test('typeahead includes checkbox menu items', async () => {
    const { container } = renderFixture();
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'k' });
    expect(document.activeElement?.textContent).toContain('Keep offline');
  });

  test('typeahead buffer resets when the menu closes', async () => {
    const { container } = renderFixture();
    const trigger = container.querySelector('.trigger') as HTMLElement;
    await fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'i' });
    expect(document.activeElement?.textContent).toContain('Invite people');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());

    await fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'a' });
    expect(document.activeElement?.textContent).toContain('Archive');
  });

  test('Space keeps native menu item activation available', async () => {
    const { container } = renderFixture();
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Copy link'));

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    document.activeElement?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  test('uses locale provider direction when no explicit direction is supplied', async () => {
    render(DropdownDirectionFixture, {
      props: { providerDirection: 'rtl' },
    });
    const container = document.body;

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    expect(container.querySelector('[role="menu"]')?.getAttribute('dir')).toBe('rtl');
  });

  test('uses local DOM direction before locale provider direction', async () => {
    render(DropdownDirectionFixture, {
      props: { providerDirection: 'rtl', localDirection: 'ltr' },
    });
    const container = document.body;

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    expect(container.querySelector('[role="menu"]')?.getAttribute('dir')).toBe('ltr');
  });

  test('resolves auto menu direction from the locale provider', async () => {
    render(DropdownDirectionFixture, {
      props: { providerDirection: 'rtl', menuDirection: 'auto' },
    });
    const container = document.body;

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    expect(container.querySelector('[role="menu"]')?.getAttribute('dir')).toBe('rtl');
  });

  test('renders no style attribute at all on the non-popover fallback path when neither anchor nor consumer style is set', async () => {
    const { container } = renderFixture();

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.hasAttribute('style')).toBe(false);
  });

  test('holds a pushEscapeHandler registration while open and releases it when close begins', async () => {
    let parentEscapeCount = 0;
    const releaseParent = pushEscapeHandler(() => {
      parentEscapeCount += 1;
    });

    try {
      const { container } = renderFixture();
      await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
      await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      (document.activeElement as HTMLElement).dispatchEvent(escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(parentEscapeCount).toBe(0);
      // Release timing (CIN-428): released the instant close begins, so the
      // parent handler (now top-most) receives the very next Escape.
      await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(parentEscapeCount).toBe(1);
    } finally {
      releaseParent();
    }
  });

  test('with the menu open above another stack registration, Escape dismisses only the menu', async () => {
    let parentEscapeCount = 0;
    const releaseParent = pushEscapeHandler(() => {
      parentEscapeCount += 1;
    });

    try {
      const { container } = renderFixture();
      await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
      await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(parentEscapeCount).toBe(0);
      await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
    } finally {
      releaseParent();
    }
  });

  test('Escape dismisses the menu with focus outside it', async () => {
    // New, intended behavior (CIN-428): the escape-stack registration fires
    // regardless of focus location, unlike the deleted target-scoped
    // `onkeydown` branch that only acted while focus was inside the panel.
    const { container } = renderFixture();
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
    outside.remove();
  });

  // happy-dom's lack of `showPopover`/`hidePopover` support (see the comment
  // below) means `context.supportsPopover` never resolves `true` in this
  // suite, so the native-popover escape-stack branch can't be exercised
  // behaviorally here — it's covered by integration tests in a real browser.
  // Assert the source directly instead (mirrors navigation-bar.test.ts's
  // CIN-376 guard), so a future edit that collapses the two effects back
  // into one calling `dismissMenu` unconditionally fails loudly: that would
  // call `event.preventDefault()` for a Popover-API-backed menu, cancelling
  // the browser's own Escape close-request and leaving the top-layer
  // popover visibly open even though `setOpen(false)` already ran.
  test('the native-popover branch registers a non-cancelling handler, not dismissMenu (review finding)', () => {
    expect(dropdownMenuSource).toContain(
      'if (!context.supportsPopover || !context.isOpen) return;\n    const releaseEscape = pushEscapeHandler((event) => {',
    );
    // It must never call preventDefault() — doing so would cancel the
    // browser's own Escape close-request for the top-layer popover. Only
    // dismissMenu (the non-popover fallback's handler) may. stopPropagation()
    // is fine (and required — see the "stops propagation" test below):
    // propagation and the native close-request default action are
    // independent.
    const popoverBranch = dropdownMenuSource.slice(
      dropdownMenuSource.indexOf('if (!context.supportsPopover || !context.isOpen) return;'),
      dropdownMenuSource.indexOf('function handleKeydown'),
    );
    expect(popoverBranch).not.toContain('.preventDefault(');
  });
});

// happy-dom does not implement `showPopover`/`hidePopover`, so
// `dropdown.svelte`'s feature-detection effect never resolves
// `supportsPopover` to `true` and every test above exercises the
// non-popover fallback path. The anchor-positioning merge tests below force
// the popover path (see dropdown.svelte's `supportsPopover` effect) so they
// can assert against a synchronous `style` value instead of the fallback
// path's async `computePosition()`-derived style. The patch is scoped to
// this describe block (applied in beforeEach, reverted in afterEach) because
// it mutates the shared `HTMLElement.prototype` for the whole test file —
// leaving it in place would silently flip every other dropdown test in this
// file onto the popover path too.
describe('DropdownMenu anchor-positioning style (popover path)', () => {
  beforeEach(() => {
    Object.assign(HTMLElement.prototype, {
      showPopover(this: HTMLElement) {},
      hidePopover(this: HTMLElement) {},
    });
  });

  afterEach(() => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    delete proto['showPopover'];
    delete proto['hidePopover'];
  });

  test('a consumer style prop merges with the anchor-positioning style instead of clobbering it', async () => {
    const { container } = renderFixture({ menuStyle: 'margin-top: 4px;' });

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.style.getPropertyValue('margin-top')).toBe('4px');
    expect(menu.style.getPropertyValue('position-anchor')).toBe('--actions-menu-menu');
  });

  test('the internal position-anchor declaration wins when a consumer style redeclares it', async () => {
    const { container } = renderFixture({ menuStyle: 'position-anchor: --consumer-injected;' });

    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.style.getPropertyValue('position-anchor')).toBe('--actions-menu-menu');
  });

  test('Escape restores focus to the trigger when focus already left the menu (review finding)', async () => {
    // Regression: the native-popover branch's escape-stack handler must not
    // preventDefault() (that would cancel the browser's own Escape
    // close-request), but native focus restoration only returns focus to
    // the invoker if focus was still *inside* the popover at the moment it
    // closes. happy-dom's stubbed showPopover/hidePopover above don't
    // simulate that native behavior at all, which is exactly why this case
    // needs its own explicit restoration: without it, focus is silently
    // left on whatever was outside, breaking dropdown.a11y.md's Escape ->
    // focus-returns-to-trigger contract.
    const { container } = renderFixture();
    const trigger = container.querySelector('.trigger') as HTMLElement;
    await fireEvent.click(trigger);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    // happy-dom's stubbed showPopover() above is a pure no-op — a real
    // browser dispatches a native `toggle` event when the popover actually
    // opens, which is what `context.isOpen` (and thus this escape-stack
    // registration) is driven by. Simulate that so the popover branch's
    // effect actually engages.
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    const openToggleEvent = new window.Event('toggle');
    Object.defineProperty(openToggleEvent, 'newState', { value: 'open' });
    menu.dispatchEvent(openToggleEvent);
    await tick();

    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const escapeEvent = new window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(escapeEvent);

    // Not cancelled: the browser's own native close-request must still run.
    expect(escapeEvent.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(trigger);
    outside.remove();
  });

  test('Escape stops propagation on the native-popover branch without cancelling native close (review finding)', async () => {
    // Regression: the no-op stack handler left the event entirely
    // unconsumed, so Escape continued to a focused input's own handler or a
    // page-level listener while the browser also dismissed the dropdown —
    // defeating the shared stack's topmost-overlay-only arbitration.
    // stopPropagation() is independent of the browser's native popover
    // close-request (that's governed by preventDefault(), which this branch
    // still must not call).
    const { container } = renderFixture();
    const trigger = container.querySelector('.trigger') as HTMLElement;
    await fireEvent.click(trigger);
    await waitFor(() => expect(container.querySelector('[role="menu"]')).not.toBeNull());

    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    const openToggleEvent = new window.Event('toggle');
    Object.defineProperty(openToggleEvent, 'newState', { value: 'open' });
    menu.dispatchEvent(openToggleEvent);
    await tick();

    // A focused input elsewhere on the page, with its own Escape handling —
    // the scenario the finding describes (e.g. a search field that clears
    // itself on Escape). Dispatch on it directly so the event actually
    // bubbles up through an ancestor, rather than dispatching on `window`
    // itself (which has no bubble path to observe).
    const outsideInput = document.createElement('input');
    document.body.append(outsideInput);
    outsideInput.focus();
    expect(document.activeElement).toBe(outsideInput);

    let outerHandlerFired = false;
    const outerHandler = () => {
      outerHandlerFired = true;
    };
    document.body.addEventListener('keydown', outerHandler);

    try {
      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      outsideInput.dispatchEvent(escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(false);
      expect(outerHandlerFired).toBe(false);
    } finally {
      document.body.removeEventListener('keydown', outerHandler);
      outsideInput.remove();
    }
  });
});
