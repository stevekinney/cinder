import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { TimelineTone } from '../timeline/timeline.types.ts';
import TimelineItem from './timeline-item.svelte';
import type { TimelineItemProps } from './timeline-item.types.ts';

type SnapshotTimelineItemProps = Omit<HTMLAttributes<HTMLLIElement>, 'class' | 'children'> & {
  datetime: string;
  timestamp: string;
  title: string;
  tone?: TimelineTone | undefined;
  connectorAfter?: 'visible' | 'hidden' | undefined;
  groupHeader?: string | undefined;
  class?: string | undefined;
  children?: Snippet | undefined;
  marker?: Snippet | undefined;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<TimelineItemProps, SnapshotTimelineItemProps> = true;
const aliasBackward: Assignable<SnapshotTimelineItemProps, TimelineItemProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotTimelineItemProps,
  ComponentProps<typeof TimelineItem>
> = true;

test('TimelineItem public prop surface matches timestamp-first API snapshot', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
