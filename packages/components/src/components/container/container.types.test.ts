/**
 * Type-equality test pinning the public Container prop surface so future edits
 * don't silently drift it.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Container from './container.svelte';
import type { ContainerMaxWidth, ContainerProps } from './container.types.ts';

type SnapshotContainerProps = {
  maxWidth?: ContainerMaxWidth;
  centered?: boolean;
  padded?: boolean;
  as?: 'div' | 'main' | 'section' | 'article';
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<SnapshotContainerProps, ContainerProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotContainerProps,
  ComponentProps<typeof Container>
> = true;

test('Container public prop surface accepts the documented snapshot', () => {
  expect(aliasForward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
