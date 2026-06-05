/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownSeparator } = await import('./dropdown-separator.svelte');

describe('DropdownSeparator', () => {
  test('renders standalone with role="separator"', () => {
    const { container } = render(DropdownSeparator);
    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
  });

  test('appears between groups inside an open menu', async () => {
    const { container } = render(Fixture);
    await fireEvent.click(container.querySelector('.trigger') as HTMLElement);
    await waitFor(() => expect(document.body.querySelector('[role="menu"]')).not.toBeNull());
    expect(document.body.querySelector('[role="menu"] [role="separator"]')).not.toBeNull();
  });
});
