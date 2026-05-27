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
// CollapsibleProps spreads HTMLAttributes<HTMLDivElement>, so a full backward
// assignability check (real → snapshot) is intentionally false and omitted —
// unlike AccordionItemProps, which is a plain object type. To still catch the
// drift a one-directional snapshot misses (a newly *required* prop), assert the
// component renders with only the snapshot's required fields supplied.
const componentAcceptsMinimalRequired: Assignable<
  { trigger: string; children: Snippet },
  ComponentProps<typeof Collapsible>
> = true;

test('Collapsible public prop surface unchanged', () => {
  expect(aliasForward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
  expect(componentAcceptsMinimalRequired).toBe(true);
});
