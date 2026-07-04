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

  type PositionedEventTimelineItem = Omit<EventTimelineItem, 'sublabel'> & {
    accessibleLabel: string;
    edge: 'end' | 'middle' | 'start';
    key: string;
    lane: number;
    position: number;
    isoDatetime: string;
    state: NonNullable<EventTimelineItem['state']>;
    stateLabel: string;
    sublabel: string | undefined;
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

  function stateLabelForItem(state: NonNullable<EventTimelineItem['state']>): string {
    if (state === 'done') return 'Done';
    if (state === 'failed') return 'Failed';
    return 'Upcoming';
  }

  function keyForItem(item: EventTimelineItem, index: number, timestamp: number): string {
    return item.id ?? `${item.label}-${new Date(timestamp).toISOString()}-${index}`;
  }

  function edgeForPosition(position: number): PositionedEventTimelineItem['edge'] {
    if (position <= 0) return 'start';
    if (position >= 100) return 'end';
    return 'middle';
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
    const lanePositions: number[] = [];

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
        const lane = availableLane === -1 ? lanePositions.length : availableLane;
        lanePositions[lane] = position;

        const isoDatetime = new Date(timestamp).toISOString();
        const state = item.state ?? 'upcoming';
        const stateLabel = stateLabelForItem(state);
        const sublabel = item.sublabel?.trim() || undefined;
        const timeLabel = sublabel ?? isoDatetime;

        return {
          ...item,
          accessibleLabel: `${item.label}, ${timeLabel}, ${stateLabel}`,
          edge: edgeForPosition(position),
          key: keyForItem(item, index, timestamp),
          lane,
          position,
          isoDatetime,
          state,
          stateLabel,
          sublabel,
        };
      });
  });

  const laneCount = $derived(Math.max(3, ...positionedItems.map((item) => item.lane + 1), 0));

  const nowPosition = $derived.by(() => {
    const timestamp = toTimestamp(now);
    if (timestamp === undefined) return undefined;
    const position = ((timestamp - range.startTimestamp) / range.duration) * 100;
    if (position < 0 || position > 100) return undefined;
    return position;
  });

  const normalizedLabel = $derived(label?.trim() || undefined);
  const normalizedAriaLabel = $derived(ariaLabel?.trim() || undefined);
  const accessibleName = $derived(normalizedAriaLabel ?? normalizedLabel ?? 'Event timeline');
</script>

<div {...rest} class={classNames('cinder-event-timeline', customClassName)} data-cinder-size={size}>
  {#if normalizedLabel}
    <div class="cinder-event-timeline__label">{normalizedLabel}</div>
  {/if}
  <div class="cinder-event-timeline__axis" aria-hidden="true">
    {#if nowPosition !== undefined}
      <div class="cinder-event-timeline__now" style:left="{nowPosition}%"></div>
    {/if}
  </div>
  <div
    class="cinder-event-timeline__items"
    role="list"
    aria-label={accessibleName}
    style:--_cinder-event-timeline-lane-count={laneCount}
  >
    {#each positionedItems as item (item.key)}
      <div
        class="cinder-event-timeline__item"
        role="listitem"
        data-cinder-state={item.state}
        data-cinder-lane={item.lane}
        data-cinder-edge={item.edge}
        aria-label={item.accessibleLabel}
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
          {:else}
            <time class="cinder-sr-only" datetime={item.isoDatetime}>{item.isoDatetime}</time>
          {/if}
          <span class="cinder-sr-only">{item.stateLabel}</span>
        </span>
      </div>
    {/each}
  </div>
</div>
