import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Timeline from './timeline.svelte';
import type { TimelineProps } from './timeline.types.ts';

type SnapshotTimelineProps = {
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<TimelineProps, SnapshotTimelineProps> = true;
const aliasBackward: Assignable<SnapshotTimelineProps, TimelineProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotTimelineProps,
  ComponentProps<typeof Timeline>
> = true;

test('Timeline public prop surface unchanged after migration', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
