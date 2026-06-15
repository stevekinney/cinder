import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import Timeline from './timeline.svelte';
import type { TimelineEntry, TimelineProps } from './timeline.types.ts';

// `role` is intentionally omitted: Timeline owns the `<ol>`'s implicit `list` role
// and the public TimelineProps excludes `role` so consumers cannot clobber it.
type SnapshotTimelineProps = Omit<
  HTMLAttributes<HTMLOListElement>,
  'class' | 'children' | 'role'
> & {
  entries: TimelineEntry[];
  orientation?: 'vertical' | 'horizontal' | undefined;
  groupBy?: 'none' | 'day' | 'week' | undefined;
  weekStartsOn?: 'sunday' | 'monday' | undefined;
  gapThresholdMinutes?: number | undefined;
  label?: string | undefined;
  class?: string | undefined;
  children?: Snippet<[TimelineEntry]> | undefined;
  marker?: Snippet<[TimelineEntry]> | undefined;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<TimelineProps, SnapshotTimelineProps> = true;
const aliasBackward: Assignable<SnapshotTimelineProps, TimelineProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotTimelineProps,
  ComponentProps<typeof Timeline>
> = true;

test('Timeline public prop surface matches entry-driven API snapshot', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
