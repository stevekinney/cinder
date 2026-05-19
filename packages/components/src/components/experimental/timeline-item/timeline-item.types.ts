import type { Snippet } from 'svelte';

/**
 * EXPERIMENTAL — TimelineItem API may change between minor versions.
 *
 * One entry in a Timeline. Renders a marker (dot or icon) on the rail
 * with the item content beside it.
 */
export type TimelineItemProps = {
  /** Optional ISO timestamp / formatted time string for the entry header. */
  time?: string;
  /** Visible event title. */
  title?: string;
  /**
   * Optional status that drives the marker color via a data attribute.
   * @default "info"
   */
  status?: 'info' | 'success' | 'warning' | 'danger';
  /** Additional class names merged with `.cinder-timeline-item`. */
  class?: string;
  /** Item body content. */
  children?: Snippet;
  /** Custom marker glyph. Default is a colored dot. */
  marker?: Snippet;
};

/** Schema generator surface for TimelineItem — excludes snippet props. */
export interface TimelineItemSchemaProps {
  /** Optional ISO timestamp / formatted time string for the entry header. */
  time?: string;
  /** Visible event title. */
  title?: string;
  /**
   * Optional status that drives the marker color via a data attribute.
   * @default "info"
   */
  status?: 'info' | 'success' | 'warning' | 'danger';
  /** Additional class names merged with `.cinder-timeline-item`. */
  class?: string;
}
