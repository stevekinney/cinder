import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Portal from './portal.svelte';
import type { PortalProps } from './portal.types.ts';

type SnapshotPortalProps = {
  children: Snippet;
  target?: HTMLElement | string | null;
  disabled?: boolean;
  class?: string;
  inheritAttributes?: boolean;
};

const componentAcceptsSnapshot: Assignable<
  SnapshotPortalProps,
  ComponentProps<typeof Portal>
> = true;
type Assignable<A, B> = A extends B ? true : false;
const explicitPropsRemainValid: Assignable<SnapshotPortalProps, PortalProps> = true;

test('Portal public prop surface matches the planned API', () => {
  expect(explicitPropsRemainValid).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
