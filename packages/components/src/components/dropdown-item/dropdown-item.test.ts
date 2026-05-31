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
  await waitFor(() => expect(result.container.querySelector('[role="menu"]')).not.toBeNull());
  return result;
}

describe('DropdownItem', () => {
  test('throws when rendered outside a Dropdown', () => {
    expect(() =>
      render(DropdownItem, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span>x</span>', setup: () => {} })),
        },
      }),
    ).toThrow(/must be used within a Dropdown/);
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

  test('Enter activates the item via the keydown-to-click bridge', async () => {
    const { container } = await openMenu();
    const item = container.querySelector('[role="menuitem"]') as HTMLElement;
    item.focus();
    await fireEvent.keyDown(item, { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('output')?.textContent).toBe('copy'));
  });
});
