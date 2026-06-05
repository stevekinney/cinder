/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');

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

describe('DropdownGroup', () => {
  test('renders each group with role="group"', async () => {
    const { container } = await openMenu();
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(2);
  });

  test('aria-labelledby points at the group label id', async () => {
    const { container } = await openMenu();
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[role="group"]'));
    expect(groups[0]?.getAttribute('aria-labelledby')).toBe('actions-menu-document-label');
    expect(groups[1]?.getAttribute('aria-labelledby')).toBe('actions-menu-sharing-label');
  });

  test('the referenced label element exists for each group', async () => {
    const { container } = await openMenu();
    expect(container.querySelector('#actions-menu-document-label')).not.toBeNull();
    expect(container.querySelector('#actions-menu-sharing-label')).not.toBeNull();
  });
});
