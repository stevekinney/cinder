import type { HTMLAttributes } from 'svelte/elements';

export type EventTimelineDate = Date | number | string;
export type EventTimelineSchemaDate = number | string;
export type EventTimelineSize = 'sm' | 'md';
export type EventTimelineState = 'done' | 'upcoming' | 'failed';

export type EventTimelineItem = {
  /** Stable key for repeated items. Defaults to `${label}-${at}`. */
  id?: string;
  /** Event timestamp, accepted by the JavaScript Date constructor. */
  at: EventTimelineDate;
  /** Primary visible label. */
  label: string;
  /** Optional secondary label. */
  sublabel?: string;
  /** Visual event state. Defaults to `upcoming`. */
  state?: EventTimelineState;
};

/**
 * Schema-facing event item shape.
 *
 * @schemaObject
 */
export type EventTimelineSchemaItem = {
  /** Stable key for repeated items. */
  id?: string;
  /** Event timestamp, accepted by the JavaScript Date constructor. */
  at: EventTimelineSchemaDate;
  /** Primary visible label. */
  label: string;
  /** Optional secondary timestamp label. */
  sublabel?: string;
  /** Visual event state. Defaults to `upcoming`. */
  state?: EventTimelineState;
};

/** Props for the EventTimeline component. */
export type EventTimelineProps = HTMLAttributes<HTMLDivElement> & {
  /** Inclusive start of the displayed time range. */
  start: EventTimelineDate;
  /** Inclusive end of the displayed time range. */
  end: EventTimelineDate;
  /** Optional current time marker. */
  now?: EventTimelineDate;
  /** Events positioned proportionally between `start` and `end`. */
  items: EventTimelineItem[];
  /** Visible heading for the timeline. */
  label?: string;
  /** Accessible name override. Defaults to `label` or `Event timeline`. */
  ariaLabel?: string;
  /** Timeline density. Default `md`. */
  size?: EventTimelineSize;
  /** Custom class merged with `.cinder-event-timeline`. */
  class?: string;
};

/** Schema generator surface for JSON-safe EventTimeline props. */
export type EventTimelineSchemaProps = {
  /** Inclusive start of the displayed time range. */
  start: EventTimelineSchemaDate;
  /** Inclusive end of the displayed time range. */
  end: EventTimelineSchemaDate;
  /** Optional current time marker. */
  now?: EventTimelineSchemaDate;
  /** Events positioned proportionally between `start` and `end`. */
  items: EventTimelineSchemaItem[];
  /** Visible heading for the timeline. */
  label?: string;
  /** Accessible name override. Defaults to `label` or `Event timeline`. */
  ariaLabel?: string;
  /** Timeline density. Default `md`. */
  size?: EventTimelineSize;
  /** Custom class merged with `.cinder-event-timeline`. */
  class?: string;
};
