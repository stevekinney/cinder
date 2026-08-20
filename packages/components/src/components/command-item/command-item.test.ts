/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: CommandPaletteFixture } =
  await import('../../test/fixtures/command-palette-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function settle() {
  await Promise.resolve();
  await tick();
}

describe('CommandItem', () => {
  test('renders a registered option composed from the shared row-item boundary', async () => {
    const { container } = render(CommandPaletteFixture);
    await settle();

    const item = container.querySelector<HTMLElement>('.cinder-command-item');
    expect(item).not.toBeNull();
    expect(item?.classList.contains('cinder-_row-item')).toBe(true);
    expect(item?.getAttribute('role')).toBe('option');
    expect(item?.textContent).toContain('Alpha');
  });

  test('moves selection with the command list keyboard contract and activates the selected item', async () => {
    const selected: string[] = [];
    const { container } = render(CommandPaletteFixture, {
      onSelected: (value: string) => selected.push(value),
    });
    await settle();

    const input = container.querySelector<HTMLInputElement>('input[role="combobox"]');
    expect(input).not.toBeNull();
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toContain('Alpha');

    await fireEvent.keyDown(input!, { key: 'ArrowDown' });
    await tick();
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toContain('Gamma');

    await fireEvent.keyDown(input!, { key: 'Enter' });
    expect(selected).toEqual(['gamma']);
  });
});
