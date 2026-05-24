import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { AvatarShape, AvatarSize } from '../avatar/avatar.types.ts';
import AvatarGroup from './avatar-group.svelte';
import type { AvatarGroupItem, AvatarGroupProps, AvatarGroupZOrder } from './avatar-group.types.ts';
import {
  AvatarGroup as PublicAvatarGroup,
  type AvatarGroupItem as PublicAvatarGroupItem,
  type AvatarGroupProps as PublicAvatarGroupProps,
  type AvatarGroupZOrder as PublicAvatarGroupZOrder,
} from './index.ts';

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
const publicAliasAssignableForward: Assignable<PublicAvatarGroupProps, SnapshotAvatarGroupProps> =
  true;
const publicAliasAssignableBackward: Assignable<SnapshotAvatarGroupProps, PublicAvatarGroupProps> =
  true;
const publicItemAssignableForward: Assignable<PublicAvatarGroupItem, AvatarGroupItem> = true;
const publicItemAssignableBackward: Assignable<AvatarGroupItem, PublicAvatarGroupItem> = true;
const publicOrderAssignableForward: Assignable<PublicAvatarGroupZOrder, AvatarGroupZOrder> = true;
const publicOrderAssignableBackward: Assignable<AvatarGroupZOrder, PublicAvatarGroupZOrder> = true;
const publicComponentAcceptsSnapshot: Assignable<
  SnapshotAvatarGroupProps,
  ComponentProps<typeof PublicAvatarGroup>
> = true;
type AvatarGroupPropsHasChildren = 'children' extends keyof AvatarGroupProps ? true : false;
type PublicAvatarGroupPropsHasChildren = 'children' extends keyof PublicAvatarGroupProps
  ? true
  : false;
const avatarGroupPropsRejectChildren: AvatarGroupPropsHasChildren = false;
const publicAvatarGroupPropsRejectChildren: PublicAvatarGroupPropsHasChildren = false;

test('AvatarGroup public prop surface matches its documented snapshot', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
  expect(publicAliasAssignableForward).toBe(true);
  expect(publicAliasAssignableBackward).toBe(true);
  expect(publicItemAssignableForward).toBe(true);
  expect(publicItemAssignableBackward).toBe(true);
  expect(publicOrderAssignableForward).toBe(true);
  expect(publicOrderAssignableBackward).toBe(true);
  expect(publicComponentAcceptsSnapshot).toBe(true);
});

test('AvatarGroup does not accept children', () => {
  expect(avatarGroupPropsRejectChildren).toBe(false);
  expect(publicAvatarGroupPropsRejectChildren).toBe(false);
});
