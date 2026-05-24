import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { AvatarShape, AvatarSize } from '../avatar/avatar.types.ts';
import AvatarGroup from './avatar-group.svelte';
import type { AvatarGroupItem, AvatarGroupProps, AvatarGroupZOrder } from './avatar-group.types.ts';

type SnapshotAvatarGroupProps = HTMLAttributes<HTMLDivElement> & {
  avatars: AvatarGroupItem[];
  maxVisible?: number;
  overlap?: string;
  zOrder?: AvatarGroupZOrder;
  size?: AvatarSize;
  shape?: AvatarShape;
  overflowLabel?: string;
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<AvatarGroupProps, SnapshotAvatarGroupProps> = true;
const aliasAssignableBackward: Assignable<SnapshotAvatarGroupProps, AvatarGroupProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotAvatarGroupProps,
  ComponentProps<typeof AvatarGroup>
> = true;

test('AvatarGroup public prop surface matches its documented snapshot', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
