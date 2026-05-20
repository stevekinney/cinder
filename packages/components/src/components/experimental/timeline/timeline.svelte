<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Vertical event-rail container that renders timeline-item children along a shared axis for workflow, audit, or run histories.
   * @tag timeline
   * @tag history
   * @tag events
   * @useWhen Visualizing an ordered sequence of events with consistent marker and content layout along a vertical rail.
   * @useWhen Displaying workflow steps, audit logs, or run histories where each entry needs a status-colored marker.
   * @avoidWhen Surfacing a real-time social or activity stream — feed is the higher-affordance composition.
   * @avoidWhen Guiding users through a numbered procedural flow — steps conveys progress more clearly.
   * @avoidWhen Production-critical surfaces — this component is alpha and may change or be removed before promotion to beta.
   * @related timeline-item, feed, steps
   */
  export type { TimelineProps } from './timeline.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../../utilities/class-names.ts';
  import type { TimelineProps } from './timeline.types.ts';

  let { class: className, children }: TimelineProps = $props();
</script>

<ol class={cn('cinder-timeline', className)}>
  {@render children()}
</ol>
