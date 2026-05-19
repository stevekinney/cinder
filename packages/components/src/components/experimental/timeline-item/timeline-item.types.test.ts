import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import TimelineItem from './timeline-item.svelte';
import type { TimelineItemProps } from './timeline-item.types.ts';

type SnapshotTimelineItemProps = {
  time?: string;
  title?: string;
  status?: 'info' | 'success' | 'warning' | 'danger';
  class?: string;
  children?: Snippet;
  marker?: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<TimelineItemProps, SnapshotTimelineItemProps> = true;
const aliasBackward: Assignable<SnapshotTimelineItemProps, TimelineItemProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotTimelineItemProps,
  ComponentProps<typeof TimelineItem>
> = true;

test('TimelineItem public prop surface unchanged after migration', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
