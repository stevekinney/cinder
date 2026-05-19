import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

import VisuallyHidden from './visually-hidden.svelte';
import type { VisuallyHiddenElement, VisuallyHiddenProps } from './visually-hidden.types.ts';

type SnapshotVisuallyHiddenProps = Omit<
  HTMLAttributes<HTMLElement> & HTMLAnchorAttributes,
  'class' | 'children'
> & {
  as?: VisuallyHiddenElement;
  focusable?: boolean;
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<VisuallyHiddenProps, SnapshotVisuallyHiddenProps> = true;
const aliasAssignableBackward: Assignable<SnapshotVisuallyHiddenProps, VisuallyHiddenProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotVisuallyHiddenProps,
  ComponentProps<typeof VisuallyHidden>
> = true;

test('VisuallyHidden public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
