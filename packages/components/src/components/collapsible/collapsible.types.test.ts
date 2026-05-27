/**
 * Type-equality test pinning the public Collapsible prop surface so future
 * edits don't silently drift it.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Collapsible from './collapsible.svelte';
import type { CollapsibleProps, CollapsibleTriggerState } from './collapsible.types.ts';

type SnapshotCollapsibleProps = {
  trigger: string | Snippet<[CollapsibleTriggerState]>;
  children: Snippet;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  disabled?: boolean;
  idBase?: string;
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<SnapshotCollapsibleProps, CollapsibleProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotCollapsibleProps,
  ComponentProps<typeof Collapsible>
> = true;

test('Collapsible public prop surface accepts the documented snapshot', () => {
  expect(aliasForward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
