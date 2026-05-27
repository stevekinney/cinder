/**
 * Type-equality test pinning the public Container prop surface so future edits
 * don't silently drift it.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Container from './container.svelte';
import type { ContainerElement, ContainerMaxWidth, ContainerProps } from './container.types.ts';

type SnapshotContainerProps = {
  maxWidth?: ContainerMaxWidth;
  centered?: boolean;
  padded?: boolean;
  as?: ContainerElement;
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<SnapshotContainerProps, ContainerProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotContainerProps,
  ComponentProps<typeof Container>
> = true;
// ContainerProps spreads HTMLAttributes<HTMLElement>, so a full backward
// assignability check (real → snapshot) is intentionally false and omitted.
// To still catch the drift a one-directional snapshot misses (a newly
// *required* prop), assert the component renders with only `children` supplied.
const componentAcceptsMinimalRequired: Assignable<
  { children: Snippet },
  ComponentProps<typeof Container>
> = true;

test('Container public prop surface unchanged', () => {
  expect(aliasForward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
  expect(componentAcceptsMinimalRequired).toBe(true);
});
