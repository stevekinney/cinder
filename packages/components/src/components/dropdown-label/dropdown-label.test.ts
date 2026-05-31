/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');

async function openMenu() {
  const result = render(Fixture);
  await fireEvent.click(result.container.querySelector('.trigger') as HTMLElement);
  await waitFor(() => expect(result.container.querySelector('[role="menu"]')).not.toBeNull());
  return result;
}

describe('DropdownLabel', () => {
  test('renders the label text inside the menu', async () => {
    const { container } = await openMenu();
    const label = container.querySelector('.cinder-dropdown-label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain('Document');
  });

  test('carries the id its group references via aria-labelledby', async () => {
    const { container } = await openMenu();
    const label = container.querySelector('#actions-menu-document-label');
    expect(label).not.toBeNull();
    const group = container.querySelector(
      '[role="group"][aria-labelledby="actions-menu-document-label"]',
    );
    expect(group).not.toBeNull();
  });

  test('is not itself an interactive menuitem', async () => {
    const { container } = await openMenu();
    const label = container.querySelector('#actions-menu-document-label');
    expect(label?.getAttribute('role')).not.toBe('menuitem');
  });
});
