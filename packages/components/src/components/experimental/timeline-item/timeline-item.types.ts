import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { TimelineTone } from '../timeline/timeline.types.ts';

/**
 * EXPERIMENTAL — TimelineItem API may change between minor versions.
 *
 * One entry in a Timeline. Renders a marker (dot or icon) on the rail
 * with the item content beside it.
 */
export type TimelineItemProps = Omit<HTMLAttributes<HTMLLIElement>, 'class' | 'children'> & {
  /** Machine-readable ISO datetime rendered into `<time datetime>`. */
  datetime: string;
  /** Visible timestamp label rendered inside `<time>`. */
  timestamp: string;
  /** Visible event title. */
  title: string;
  /** Semantic marker tone. @default "info" */
  tone?: TimelineTone | undefined;
  /** Whether to draw the connector to the following event. @default "visible" */
  connectorAfter?: 'visible' | 'hidden' | undefined;
  /** Optional adjacent group header rendered inside this list item before the event body. */
  groupHeader?: string | undefined;
  /** Additional class names merged with `.cinder-timeline-item`. */
  class?: string | undefined;
  /** Item body content. */
  children?: Snippet | undefined;
  /** Decorative custom marker glyph. Must not contain interactive descendants. */
  marker?: Snippet | undefined;
};

/** Schema generator surface for TimelineItem — excludes snippet props. */
export interface TimelineItemSchemaProps {
  /** Machine-readable ISO datetime rendered into `<time datetime>`. */
  datetime: string;
  /** Visible timestamp label rendered inside `<time>`. */
  timestamp: string;
  /** Visible event title. */
  title: string;
  /** Semantic marker tone. @default "info" */
  tone?: TimelineTone | undefined;
  /** Whether to draw the connector to the following event. @default "visible" */
  connectorAfter?: 'visible' | 'hidden' | undefined;
  /** Optional adjacent group header rendered inside this list item before the event body. */
  groupHeader?: string | undefined;
  /** Additional class names merged with `.cinder-timeline-item`. */
  class?: string | undefined;
}
