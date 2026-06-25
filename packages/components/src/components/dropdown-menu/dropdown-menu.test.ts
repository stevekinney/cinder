/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
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

function renderFixture() {
  const result = render(Fixture);
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
});
