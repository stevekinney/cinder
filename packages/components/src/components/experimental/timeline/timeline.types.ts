import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type TimelineOrientation = 'vertical' | 'horizontal';
export type TimelineGroupBy = 'none' | 'day' | 'week';
export type TimelineWeekStartsOn = 'sunday' | 'monday';
export type TimelineTone = 'info' | 'success' | 'warning' | 'error';
export type TimelineHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type TimelineEntry = {
  /** Stable id used as the keyed list identity. */
  id: string;
  /** Machine-readable ISO datetime rendered into `<time datetime>`. */
  datetime: string;
  /** Visible timestamp label rendered inside `<time>`. */
  timestamp: string;
  /** Visible event title. */
  title: string;
  /** Semantic marker tone. @default "info" */
  tone?: TimelineTone | undefined;
  /** Optional day/week group label override. The first entry in a group wins. */
  groupLabel?: string | undefined;
};

/**
 * EXPERIMENTAL — Timeline API may change between minor versions.
 *
 * Event-rail list for workflow events, audit logs, run histories, and
 * timestamp-first sequences. Timeline is not a live region; use Feed for
 * streaming activity that assistive technology should announce.
 */
export type TimelineProps = Omit<
  HTMLAttributes<HTMLOListElement>,
  'class' | 'children' | 'role'
> & {
  /**
   * Timeline entries rendered in source order.
   * @schemaObject
   */
  entries: TimelineEntry[];
  /** Layout orientation. @default "vertical" */
  orientation?: TimelineOrientation | undefined;
  /** Optional adjacent UTC day/week grouping mode. @default "none" */
  groupBy?: TimelineGroupBy | undefined;
  /** Week start used for UTC week grouping. @default "monday" */
  weekStartsOn?: TimelineWeekStartsOn | undefined;
  /** Heading level applied to rendered group headers. @default 3 */
  groupHeaderLevel?: TimelineHeadingLevel | undefined;
  /** Hide the following connector when adjacent valid timestamps exceed this gap. */
  gapThresholdMinutes?: number | undefined;
  /** Fallback accessible label used only when aria-label and aria-labelledby are absent. */
  label?: string | undefined;
  /** Additional class names merged with `.cinder-timeline`. */
  class?: string | undefined;
  /** Optional per-entry body content. */
  children?: Snippet<[TimelineEntry]> | undefined;
  /** Decorative per-entry marker content. Must not contain interactive descendants. */
  marker?: Snippet<[TimelineEntry]> | undefined;
};

/** Schema generator surface for Timeline — excludes snippet props. */
export interface TimelineSchemaProps {
  /**
   * Timeline entries rendered in source order.
   * @schemaObject
   */
  entries: TimelineEntry[];
  /** Layout orientation. @default "vertical" */
  orientation?: TimelineOrientation | undefined;
  /** Optional adjacent UTC day/week grouping mode. @default "none" */
  groupBy?: TimelineGroupBy | undefined;
  /** Week start used for UTC week grouping. @default "monday" */
  weekStartsOn?: TimelineWeekStartsOn | undefined;
  /** Heading level applied to rendered group headers. @default 3 */
  groupHeaderLevel?: TimelineHeadingLevel | undefined;
  /** Hide the following connector when adjacent valid timestamps exceed this gap. */
  gapThresholdMinutes?: number | undefined;
  /** Fallback accessible label used only when aria-label and aria-labelledby are absent. */
  label?: string | undefined;
  /** Additional class names merged with `.cinder-timeline`. */
  class?: string | undefined;
}
