<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Timestamp-first event rail that renders workflow, audit, or run-history entries with grouping, tone markers, and connector continuity.
   * @tag timeline
   * @tag history
   * @tag events
   * @useWhen Visualizing an ordered sequence of dated events with a temporal rail, timestamp labels, grouping headers, and marker tones.
   * @useWhen Displaying workflow steps, audit logs, or run histories where each entry needs connector continuity or gap breaks.
   * @avoidWhen Surfacing a real-time social or activity stream — feed is the higher-affordance composition.
   * @avoidWhen Guiding users through a numbered procedural flow — steps conveys progress more clearly.
   * @related timeline-item, feed, steps
   */
  export type {
    TimelineEntry,
    TimelineGroupBy,
    TimelineHeadingLevel,
    TimelineOrientation,
    TimelineProps,
    TimelineTone,
    TimelineWeekStartsOn,
  } from './timeline.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';
  import TimelineItem from '../timeline-item/timeline-item.svelte';
  import { buildTimelineRenderPlan } from './timeline-groups.ts';
  import type { TimelineProps } from './timeline.types.ts';

  type TimelineInternalProps = TimelineProps & { role?: unknown };

  let {
    entries,
    orientation = 'vertical',
    groupBy = 'none',
    weekStartsOn = 'monday',
    groupHeaderLevel = 3,
    gapThresholdMinutes,
    label,
    class: className,
    children,
    marker: customMarker,
    role: _role,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: TimelineInternalProps = $props();

  const renderGroups = $derived(
    buildTimelineRenderPlan({
      entries,
      groupBy,
      weekStartsOn,
      gapThresholdMinutes,
    }),
  );

  const resolvedAriaLabel = $derived(
    ariaLabelledby === undefined && ariaLabel === undefined ? label : ariaLabel,
  );
</script>

<ol
  {...rest}
  class={cn('cinder-timeline', className)}
  data-cinder-orientation={orientation}
  aria-label={resolvedAriaLabel}
  aria-labelledby={ariaLabelledby}
  tabindex={orientation === 'horizontal' ? 0 : undefined}
>
  {#each renderGroups as group (group.key)}
    {#each group.entries as renderEntry (renderEntry.entry.id)}
      {@const entry = renderEntry.entry}
      {#snippet markerContent()}
        {#if customMarker}
          {@render customMarker(entry)}
        {/if}
      {/snippet}
      <TimelineItem
        datetime={entry.datetime}
        timestamp={entry.timestamp}
        title={entry.title}
        tone={entry.tone ?? 'info'}
        connectorAfter={renderEntry.connectorAfter}
        groupHeader={renderEntry.index === group.entries[0]?.index ? group.label : undefined}
        {groupHeaderLevel}
        marker={customMarker ? markerContent : undefined}
      >
        {#if children}
          {@render children(entry)}
        {/if}
      </TimelineItem>
    {/each}
  {/each}
</ol>
