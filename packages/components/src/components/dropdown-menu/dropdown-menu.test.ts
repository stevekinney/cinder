/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownDirectionFixture } =
  await import('../../test/fixtures/dropdown-direction-fixture.svelte');
const { default: DropdownMenu } = await import('./dropdown-menu.svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
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
});
