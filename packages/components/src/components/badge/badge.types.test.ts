import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import Badge from './badge.svelte';
import type { BadgeProps, BadgeSize, BadgeSubscriptionState, BadgeVariant } from './badge.types.ts';

type SnapshotBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  subscriptionState?: BadgeSubscriptionState;
  class?: string;
  children?: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<BadgeProps, SnapshotBadgeProps> = true;
const aliasAssignableBackward: Assignable<SnapshotBadgeProps, BadgeProps> = true;
const componentAcceptsSnapshot: Assignable<SnapshotBadgeProps, ComponentProps<typeof Badge>> = true;

test('Badge public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
