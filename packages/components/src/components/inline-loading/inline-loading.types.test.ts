import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import InlineLoading from './inline-loading.svelte';
import type { InlineLoadingProps } from './inline-loading.types.ts';

type SnapshotInlineLoadingProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  status?: 'inactive' | 'active' | 'finished' | 'error';
  description?: string;
  iconDescription?: string;
  successDelay?: number;
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<InlineLoadingProps, SnapshotInlineLoadingProps> = true;
const aliasAssignableBackward: Assignable<SnapshotInlineLoadingProps, InlineLoadingProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotInlineLoadingProps,
  ComponentProps<typeof InlineLoading>
> = true;

test('InlineLoading prop surface matches the public snapshot', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
