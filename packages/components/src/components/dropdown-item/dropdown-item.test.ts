/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: PolyFixture } =
  await import('../../test/fixtures/dropdown-item-polymorphic-fixture.svelte');
const { default: RadioFixture } =
  await import('../../test/fixtures/dropdown-item-radio-fixture.svelte');
const { default: DropdownItem } = await import('./dropdown-item.svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function openMenu() {
  const result = render(Fixture);
  await fireEvent.click(result.container.querySelector('.trigger') as HTMLElement);
  await waitFor(() => expect(document.body.querySelector('[role="menu"]')).not.toBeNull());
  return { ...result, container: document.body };
}

describe('DropdownItem', () => {
  test('throws when rendered outside a Dropdown', () => {
    expect(() =>
      render(DropdownItem, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span>x</span>', setup: () => {} })),
        },
      }),
    ).toThrow(/missing_context/);
  });

  test('renders as a button with role="menuitem"', async () => {
    const { container } = await openMenu();
    const item = container.querySelector('[role="menuitem"]');
    expect(item).not.toBeNull();
    expect(item?.tagName.toLowerCase()).toBe('button');
  });

  test('clicking an item invokes its onclick and closes the menu', async () => {
    const { container } = await openMenu();
    await fireEvent.click(container.querySelector('[role="menuitem"]') as HTMLElement);
    expect(container.querySelector('output')?.textContent).toBe('copy');
    await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
  });

  test('button has tabindex=-1 for roving-focus compatibility', async () => {
    const { container } = await openMenu();
    const item = container.querySelector('[role="menuitem"]') as HTMLElement;
    expect(item.getAttribute('tabindex')).toBe('-1');
  });

  test('menuitemradio rows expose aria-checked state', async () => {
    const result = render(RadioFixture);
    await fireEvent.click(result.container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.body.querySelector('[role="menu"]')).not.toBeNull());
    const container = document.body;
    const radioItems = Array.from(container.querySelectorAll('[role="menuitemradio"]'));

    expect(radioItems).toHaveLength(2);
    expect(radioItems[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radioItems[1]?.getAttribute('aria-checked')).toBe('false');
  });

  test('keydown Enter/Space does not synthesize a click (no double-fire)', async () => {
    const { container } = await openMenu();
    const item = container.querySelector('[role="menuitem"]') as HTMLElement;
    item.focus();

    // Fire multiple keydown events as would happen when a key is held — a
    // Space held down produces repeated keydown events. With the old
    // handleKeydown bridge each repetition dispatched a synthetic click,
    // causing multi-fire.  After the fix, keydown alone must not trigger
    // activation; only a real click event should.
    await fireEvent.keyDown(item, { key: ' ' });
    await fireEvent.keyDown(item, { key: ' ' });
    await fireEvent.keyDown(item, { key: 'Enter' });
    await fireEvent.keyDown(item, { key: 'Enter' });

    // After all those keydowns the output must still be empty — none should
    // have fired the onclick handler via a synthetic MouseEvent('click').
    expect(container.querySelector('output')?.textContent).toBe('');

    // A real click still works.
    await fireEvent.click(item);
    await waitFor(() => expect(container.querySelector('output')?.textContent).toBe('copy'));
  });
});

async function openPolyMenu() {
  const result = render(PolyFixture);
  await fireEvent.click(result.container.querySelector('.trigger') as HTMLElement);
  await waitFor(() => expect(document.body.querySelector('[role="menu"]')).not.toBeNull());
  return { ...result, container: document.body };
}

describe('DropdownItem — polymorphism', () => {
  test('link item renders as an <a> element with role="menuitem"', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const linkItem = items[0];
    expect(linkItem?.tagName.toLowerCase()).toBe('a');
    expect(linkItem?.getAttribute('href')).toBe('https://example.com');
    expect(linkItem?.getAttribute('role')).toBe('menuitem');
    expect(linkItem?.getAttribute('tabindex')).toBe('-1');
  });

  test('submit item renders as a <button type="submit">', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const submitItem = items[1];
    expect(submitItem?.tagName.toLowerCase()).toBe('button');
    expect(submitItem?.getAttribute('type')).toBe('submit');
    expect(submitItem?.getAttribute('role')).toBe('menuitem');
  });

  test('button item forwards standard <button> attributes (name/value) for form submission', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const submitItem = items[1];
    // The button branch keeps the full HTMLButtonAttributes surface, so a
    // form-submitting menu item can carry name/value (e.g. <button name="action" value="logout">).
    expect(submitItem?.getAttribute('name')).toBe('action');
    expect(submitItem?.getAttribute('value')).toBe('logout');
  });

  test('clicking a link item invokes onclick and closes the menu', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const linkItem = items[0] as HTMLElement;
    await fireEvent.click(linkItem);
    expect(container.querySelector('output')?.textContent).toBe('link');
    await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
  });

  test('clicking a submit item invokes onclick and closes the menu', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const submitItem = items[1] as HTMLElement;
    await fireEvent.click(submitItem);
    expect(container.querySelector('output')?.textContent).toBe('submit');
    await waitFor(() => expect(container.querySelector('[role="menu"]')).toBeNull());
  });

  test('Space activates a link item (matching button-row keyboard behavior)', async () => {
    // A native <a> activates on Enter but not Space; the WAI-ARIA menuitem
    // pattern requires both. The component translates Space into activation.
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const linkItem = items[0] as HTMLElement;
    const event = await fireEvent.keyDown(linkItem, { key: ' ' });
    // Space is consumed (no page scroll) and the link is activated.
    expect(event).toBe(false); // fireEvent returns false when preventDefault was called
    expect(container.querySelector('output')?.textContent).toBe('link');
  });

  test('a link item still forwards a consumer onkeydown handler', async () => {
    // The Space-to-activate handler must compose with — not replace — a
    // consumer-provided onkeydown (it is part of the public HTMLAttributes surface).
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const linkItem = items[0] as HTMLElement;
    await fireEvent.keyDown(linkItem, { key: 'ArrowRight' });
    const keyOutput = container.querySelector('[data-testid="last-link-key"]');
    expect(keyOutput?.textContent).toBe('ArrowRight');
  });

  test('disabled link item blocks its onclick and does not close the menu', async () => {
    const { container } = await openPolyMenu();
    const items = container.querySelectorAll('[role="menuitem"]');
    const disabledLink = items[2] as HTMLElement;
    expect(disabledLink?.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(disabledLink);
    // onclick was blocked
    expect(container.querySelector('output')?.textContent).toBe('');
    // menu remains open
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
  });
});
