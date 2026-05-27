import { expect, test } from 'bun:test';
import type { Snippet } from 'svelte';

import type { CommandItemProps } from './command-item.types.ts';

const children = (() => '') as unknown as Snippet;

const paletteItem: CommandItemProps = {
  value: 'open',
  onselect: () => {},
  children,
};

const menuItem: CommandItemProps = {
  value: 'open',
  selectionMode: 'parent',
  children,
};

// @ts-expect-error CommandPalette-style items must provide an activation callback.
const inertPaletteItem: CommandItemProps = {
  value: 'open',
  children,
};

test('CommandItem props require onselect unless parent-owned selection is explicit', () => {
  expect(paletteItem.value).toBe('open');
  expect(menuItem.selectionMode).toBe('parent');
  expect(inertPaletteItem.value).toBe('open');
});
