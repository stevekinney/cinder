/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownItem } = await import('./dropdown-item.svelte');

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
