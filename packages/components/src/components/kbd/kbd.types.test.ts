import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import Kbd from './kbd.svelte';
import type { KbdProps, KbdSize } from './kbd.types.ts';

type KbdBaseProps = HTMLAttributes<HTMLElement> & {
  class?: string;
  size?: KbdSize;
};

type KbdWithLabel = KbdBaseProps & {
  label: string;
  children?: Snippet;
};

type KbdWithChildren = KbdBaseProps & {
  label?: string;
  children: Snippet;
};

type SnapshotKbdProps = KbdWithLabel | KbdWithChildren;

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<KbdProps, SnapshotKbdProps> = true;
const aliasAssignableBackward: Assignable<SnapshotKbdProps, KbdProps> = true;
const componentAcceptsSnapshot: Assignable<SnapshotKbdProps, ComponentProps<typeof Kbd>> = true;

test('Kbd public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
