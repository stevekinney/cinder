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
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import { tick } from 'svelte';

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
    timestamp: number;
    isoDatetime: string;
    state: NonNullable<EventTimelineItem['state']>;
    stateLabel: string;
    sublabel: string | undefined;
  };

  type EventTimelineCluster = {
    accessibleLabel: string;
    count: number;
    edge: PositionedEventTimelineItem['edge'];
    endTime: string;
    key: string;
    lane: number;
    position: number;
    startTime: string;
    items: PositionedEventTimelineItem[];
  };

  const MAX_VISIBLE_LANES = 4;
  const LABEL_MAX_WIDTH_REM = { sm: 7, md: 9 } as const;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;

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

  let measuredWidth = $state(0);
  let openCluster = $state(false);
  let clusterTrigger = $state<HTMLButtonElement | null>(null);

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
    return `${item.id ?? `${item.label}-${new Date(timestamp).toISOString()}`}-${index}`;
  }

  function edgeForPosition(position: number): PositionedEventTimelineItem['edge'] {
    if (position <= 0) return 'start';
    if (position >= 100) return 'end';
    return 'middle';
  }

  function getLabelMaxWidthPx(): number {
    if (typeof window === 'undefined') {
      return LABEL_MAX_WIDTH_REM[size] * FALLBACK_ROOT_FONT_SIZE_PX;
    }

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return LABEL_MAX_WIDTH_REM[size] * baseFontSize;
  }

  function getObservedWidth(entry: ResizeObserverEntry): number {
    const borderBoxSize = Array.isArray(entry.borderBoxSize)
      ? entry.borderBoxSize[0]
      : entry.borderBoxSize;
    return borderBoxSize?.inlineSize ?? entry.contentRect.width;
  }

  function updateMeasuredWidth(width: number): void {
    if (Number.isFinite(width) && width > 0) measuredWidth = width;
  }

  const observeResize = useResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) updateMeasuredWidth(getObservedWidth(entry));
  });

  const observeItems = (node: HTMLElement) => {
    updateMeasuredWidth(node.getBoundingClientRect().width);
    return observeResize(node);
  };

  const collisionThresholdPercent = $derived(
    measuredWidth > 0 ? (getLabelMaxWidthPx() / measuredWidth) * 100 : 100,
  );

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

  const positionedLayout = $derived.by<{
    clusters: EventTimelineCluster[];
    items: PositionedEventTimelineItem[];
  }>(() => {
    const lanePositions: number[] = [];
    const visibleItems: PositionedEventTimelineItem[] = [];
    const overflowItems: PositionedEventTimelineItem[] = [];

    items
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
          (lastPosition) => position - lastPosition >= collisionThresholdPercent,
        );
        const nextLane = availableLane === -1 ? lanePositions.length : availableLane;
        const isOverflow = availableLane === -1 && nextLane >= MAX_VISIBLE_LANES;
        const lane = isOverflow ? MAX_VISIBLE_LANES : nextLane;
        if (!isOverflow) lanePositions[lane] = position;

        const isoDatetime = new Date(timestamp).toISOString();
        const state = item.state ?? 'upcoming';
        const stateLabel = stateLabelForItem(state);
        const sublabel = item.sublabel?.trim() || undefined;
        const timeLabel = sublabel ?? isoDatetime;

        const positionedItem = {
          ...item,
          accessibleLabel: `${item.label}, ${timeLabel}, ${stateLabel}`,
          edge: edgeForPosition(position),
          key: keyForItem(item, index, timestamp),
          lane,
          position,
          timestamp,
          isoDatetime,
          state,
          stateLabel,
          sublabel,
        };

        if (lane >= MAX_VISIBLE_LANES) {
          overflowItems.push(positionedItem);
        } else {
          visibleItems.push(positionedItem);
        }
        return positionedItem;
      });

    const clusters: EventTimelineCluster[] = [];
    if (overflowItems.length > 0) {
      const first = overflowItems[0]!;
      const last = overflowItems.at(-1)!;
      const startTime = new Date(first.timestamp).toISOString().slice(11, 16);
      const endTime = new Date(last.timestamp).toISOString().slice(11, 16);
      const countLabel = overflowItems.length === 1 ? 'event' : 'events';
      clusters.push({
        accessibleLabel: `${overflowItems.length} ${countLabel} between ${startTime} and ${endTime}`,
        count: overflowItems.length,
        edge: edgeForPosition(first.position),
        endTime,
        key: `cluster-${first.key}`,
        lane: MAX_VISIBLE_LANES,
        position: first.position,
        startTime,
        items: overflowItems,
      });
    }

    return { clusters, items: visibleItems };
  });

  const positionedItems = $derived(positionedLayout.items);
  const clusters = $derived(positionedLayout.clusters);

  const laneCount = $derived(
    Math.max(
      3,
      ...positionedItems.map((item) => item.lane + 1),
      ...clusters.map((cluster) => cluster.lane + 1),
      0,
    ),
  );

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

  function closeCluster(): void {
    openCluster = false;
    void tick().then(() => clusterTrigger?.focus());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !openCluster) return;
    event.preventDefault();
    closeCluster();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

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
    {@attach observeItems}
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
        data-cinder-lane-parity={item.lane % 2 === 0 ? 'even' : 'odd'}
        data-cinder-edge={item.edge}
        aria-label={item.accessibleLabel}
        style:left="{item.position}%"
        style:--_cinder-event-timeline-lane={item.lane}
      >
        <span class="cinder-event-timeline__dot" aria-hidden="true"></span>
        <span class="cinder-event-timeline__leader" aria-hidden="true"></span>
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
    {#each clusters as cluster (cluster.key)}
      <div
        class="cinder-event-timeline__cluster"
        role="listitem"
        data-cinder-edge={cluster.edge}
        data-cinder-lane={cluster.lane}
        style:left="{cluster.position}%"
        style:--_cinder-event-timeline-lane={cluster.lane}
      >
        <button
          class="cinder-event-timeline__cluster-trigger"
          type="button"
          tabindex="0"
          aria-expanded={openCluster}
          aria-label={cluster.accessibleLabel}
          onclick={(event) => {
            clusterTrigger = event.currentTarget as HTMLButtonElement;
            openCluster = !openCluster;
          }}>+{cluster.count}</button
        >
        {#if openCluster}
          <div
            class="cinder-event-timeline__cluster-surface"
            role="dialog"
            aria-label={cluster.accessibleLabel}
          >
            <strong>{cluster.accessibleLabel}</strong>
            <ul>
              {#each cluster.items as hiddenItem (hiddenItem.key)}
                <li>{hiddenItem.label}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
