import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import FocusTrap from './focus-trap.svelte';
import type { FocusTrapProps } from './focus-trap.types.ts';

type SnapshotFocusTrapProps = {
  children: Snippet;
  active?: boolean;
  restoreFocus?: boolean;
  initialFocus?: HTMLElement | string | null;
  fallbackFocus?: HTMLElement | string | null;
  class?: string;
};

const componentAcceptsSnapshot: Assignable<
  SnapshotFocusTrapProps,
  ComponentProps<typeof FocusTrap>
> = true;
type Assignable<A, B> = A extends B ? true : false;
const explicitPropsRemainValid: Assignable<SnapshotFocusTrapProps, FocusTrapProps> = true;

test('FocusTrap public prop surface matches the planned API', () => {
  expect(explicitPropsRemainValid).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
