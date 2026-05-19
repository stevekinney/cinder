import type { Snippet } from 'svelte';

/**
 * EXPERIMENTAL — Timeline API may change between minor versions.
 *
 * Vertical event-rail container. Render TimelineItem children inside.
 * Useful for workflow events, audit logs, run histories.
 */
export type TimelineProps = {
  /** Additional class names merged with `.cinder-timeline`. */
  class?: string;
  /** TimelineItem children. */
  children: Snippet;
};

/** Schema generator surface for Timeline — excludes snippet props. */
export interface TimelineSchemaProps {
  /** Additional class names merged with `.cinder-timeline`. */
  class?: string;
}
