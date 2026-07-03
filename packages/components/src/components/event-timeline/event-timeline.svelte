<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Horizontal time-axis strip for scheduled events with proportional dots, a now marker, and collision-nudged labels.
   * @tag event-timeline
   * @tag schedule
   * @tag timeline
   * @useWhen Showing several fired and upcoming events across a bounded time window, such as a next-24-hour schedule strip.
   * @avoidWhen Showing vertical process history or dense activity feeds. | timeline
   * @avoidWhen Showing step-by-step run execution state. | run-step-timeline
   * @related timeline, run-step-timeline, status-dot
   */
  export type {
    EventTimelineDate,
    EventTimelineItem,
    EventTimelineProps,
    EventTimelineSize,
    EventTimelineState,
  } from './event-timeline.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type {
    EventTimelineDate,
    EventTimelineItem,
    EventTimelineProps,
  } from './event-timeline.types.ts';

  type PositionedEventTimelineItem = EventTimelineItem & {
    key: string;
    lane: number;
    position: number;
    isoDatetime: string;
    state: NonNullable<EventTimelineItem['state']>;
  };

  let {
    start,
    end,
    now,
    items,
    label,
    ariaLabel,
    size = 'md',
    class: customClassName,
    ...rest
  }: EventTimelineProps = $props();

  function toTimestamp(value: EventTimelineDate | undefined): number | undefined {
    if (value === undefined) return undefined;
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  function clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  function keyForItem(item: EventTimelineItem, index: number): string {
    return item.id ?? `${item.label}-${String(item.at)}-${index}`;
  }

  const range = $derived.by(() => {
    const startTimestamp = toTimestamp(start) ?? 0;
    const endTimestamp = toTimestamp(end);
    const safeEndTimestamp =
      endTimestamp !== undefined && endTimestamp > startTimestamp
        ? endTimestamp
        : startTimestamp + 1;

    return {
      startTimestamp,
      endTimestamp: safeEndTimestamp,
      duration: safeEndTimestamp - startTimestamp,
    };
  });

  const positionedItems = $derived.by<PositionedEventTimelineItem[]>(() => {
    const lanePositions = [-Infinity, -Infinity, -Infinity];

    return items
      .map((item, index) => {
        const timestamp = toTimestamp(item.at);
        if (timestamp === undefined) return undefined;

        return {
          item,
          index,
          timestamp,
          position: clampPercent(((timestamp - range.startTimestamp) / range.duration) * 100),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .sort((a, b) => a.position - b.position)
      .map(({ item, index, timestamp, position }) => {
        const availableLane = lanePositions.findIndex(
          (lastPosition) => position - lastPosition >= 12,
        );
        const lane = availableLane === -1 ? 2 : availableLane;
        lanePositions[lane] = position;

        return {
          ...item,
          key: keyForItem(item, index),
          lane,
          position,
          isoDatetime: new Date(timestamp).toISOString(),
          state: item.state ?? 'upcoming',
        };
      });
  });

  const nowPosition = $derived.by(() => {
    const timestamp = toTimestamp(now);
    if (timestamp === undefined) return undefined;
    return clampPercent(((timestamp - range.startTimestamp) / range.duration) * 100);
  });

  const normalizedLabel = $derived(label?.trim() || undefined);
  const normalizedAriaLabel = $derived(ariaLabel?.trim() || undefined);
  const accessibleName = $derived(normalizedAriaLabel ?? normalizedLabel ?? 'Event timeline');
</script>

<div {...rest} class={classNames('cinder-event-timeline', customClassName)} data-cinder-size={size}>
  {#if normalizedLabel}
    <div class="cinder-event-timeline__label">{label}</div>
  {/if}
  <div class="cinder-event-timeline__axis" aria-hidden="true">
    {#if nowPosition !== undefined}
      <div class="cinder-event-timeline__now" style:left="{nowPosition}%"></div>
    {/if}
  </div>
  <div class="cinder-event-timeline__items" role="list" aria-label={accessibleName}>
    {#each positionedItems as item (item.key)}
      <div
        class="cinder-event-timeline__item"
        role="listitem"
        data-cinder-state={item.state}
        data-cinder-lane={item.lane}
        style:left="{item.position}%"
        style:--_cinder-event-timeline-lane={item.lane}
      >
        <span class="cinder-event-timeline__dot" aria-hidden="true"></span>
        <span class="cinder-event-timeline__content">
          <span class="cinder-event-timeline__item-label">{item.label}</span>
          {#if item.sublabel}
            <time class="cinder-event-timeline__item-sublabel" datetime={item.isoDatetime}
              >{item.sublabel}</time
            >
          {/if}
        </span>
      </div>
    {/each}
  </div>
</div>
