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
  import { createClickOutside } from '../../utilities/attachments.ts';
  import { createPortalAttachment } from '../portal/index.ts';
  import { isEventTimelineModal } from './event-timeline-modal.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import { tick } from 'svelte';

  import type {
    EventTimelineDate,
    EventTimelineItem,
    EventTimelineProps,
  } from './event-timeline.types.ts';

  type PositionedEventTimelineItem = Omit<EventTimelineItem, 'sublabel'> & {
    accessibleLabel: string;
    centered: boolean;
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

  type EventTimelineRenderItem =
    | { kind: 'item'; key: string; position: number; item: PositionedEventTimelineItem }
    | { kind: 'cluster'; key: string; position: number; cluster: EventTimelineCluster };

  const MAX_VISIBLE_LANES = 4;
  const LABEL_MAX_WIDTH_REM = { sm: 7, md: 9 } as const;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;
  const FALLBACK_COLLISION_THRESHOLD_PERCENT = 10;

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
  let rootFontSize = $state(FALLBACK_ROOT_FONT_SIZE_PX);
  let openClusterKey = $state<string | null>(null);
  let clusterTrigger = $state<HTMLButtonElement | null>(null);
  let clusterSurface = $state<HTMLDivElement | null>(null);
  let isRtl = $state(false);
  const instanceId = $props.id();
  function portalOwner(): HTMLElement | null {
    const trigger = clusterTrigger;
    if (!trigger) return null;
    try {
      const focusTrapRoot = trigger.closest<HTMLElement>(
        '.cinder-modal__panel, .cinder-sheet__panel, .cinder-drawer__panel, .cinder-popover',
      );
      if (focusTrapRoot) return focusTrapRoot;
      const dialog = trigger.closest<HTMLElement>('dialog');
      return (
        (dialog && isEventTimelineModal(dialog) ? dialog : null) ??
        (typeof CSS !== 'undefined' && CSS.supports?.('selector(:popover-open)')
          ? trigger.closest<HTMLElement>('[popover]:popover-open')
          : null)
      );
    } catch {
      return null;
    }
  }
  const clusterPortalAttachment = createPortalAttachment({
    // Anchored overlay coordinates are viewport-relative (fixed strategy). Keep the
    // surface in the document top layer so transformed dialog containers cannot
    // become a competing fixed-position containing block.
    target: () => {
      return portalOwner() ?? document.body;
    },
    inheritAttributes: true,
    source: () => clusterTrigger,
  });

  const anchoredClusterSurface = createAnchoredOverlay({
    open: () => openClusterKey !== null,
    anchor: () => clusterTrigger,
    panel: () => clusterSurface,
    placement: () => 'bottom-start',
    offset: () => 8,
    shiftPadding: () => 8,
    strategy: () => {
      const owner = portalOwner();
      if (!owner) return 'fixed';
      const style = getComputedStyle(owner);
      return style.transform !== 'none' ||
        style.translate !== 'none' ||
        style.scale !== 'none' ||
        style.rotate !== 'none' ||
        style.filter !== 'none' ||
        style.contain !== 'none'
        ? 'absolute'
        : 'fixed';
    },
  });

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

  function edgeForPosition(
    position: number,
    thresholdPercent = FALLBACK_COLLISION_THRESHOLD_PERCENT,
    offsetPercent = 0,
  ): PositionedEventTimelineItem['edge'] {
    const edgeThreshold = Math.max(10, thresholdPercent / 2 + offsetPercent);
    const nearStart = position <= edgeThreshold;
    const nearEnd = position >= 100 - edgeThreshold;
    if (nearStart && nearEnd) return position <= 50 ? 'start' : 'end';
    if (nearStart) return 'start';
    if (nearEnd) return 'end';
    return 'middle';
  }

  function transformedLabelBounds(
    position: number,
    edge: PositionedEventTimelineItem['edge'],
    labelWidthPercent: number,
    offsetPercent: number,
    lane = 0,
  ): { start: number; end: number } {
    if (edge === 'start') return { start: position, end: position + labelWidthPercent };
    if (edge === 'end') return { start: position - labelWidthPercent, end: position };

    const directionalOffset = (lane % 2 === 0 ? -offsetPercent : offsetPercent) * (isRtl ? -1 : 1);
    return {
      start: position + directionalOffset - labelWidthPercent / 2,
      end: position + directionalOffset + labelWidthPercent / 2,
    };
  }

  function getLabelMaxWidthPx(): number {
    return LABEL_MAX_WIDTH_REM[size] * rootFontSize;
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
    const updateDirection = () => {
      isRtl = getComputedStyle(node).direction === 'rtl';
    };
    updateMeasuredWidth(node.getBoundingClientRect().width);
    updateDirection();
    const directionObserver = new MutationObserver(updateDirection);
    directionObserver.observe(node.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'dir', 'style'],
      subtree: true,
    });
    const stopResizeObserver = observeResize(node);
    return () => {
      directionObserver.disconnect();
      stopResizeObserver?.();
    };
  };

  $effect(() => {
    if (typeof window === 'undefined') return;
    const updateRootFontSize = () => {
      const value = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (Number.isFinite(value) && value > 0) rootFontSize = value;
    };
    updateRootFontSize();
    const observer = new MutationObserver(updateRootFontSize);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    window.addEventListener('resize', updateRootFontSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRootFontSize);
    };
  });

  const collisionThresholdPercent = $derived(
    measuredWidth > 0
      ? (getLabelMaxWidthPx() / measuredWidth) * 100
      : FALLBACK_COLLISION_THRESHOLD_PERCENT,
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
    const laneBounds: Array<{ end: number }> = [];
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
        const offsetPercent =
          measuredWidth > 0
            ? ((6 * rootFontSize) / measuredWidth) * 100
            : (6 / LABEL_MAX_WIDTH_REM[size]) * collisionThresholdPercent;
        const preferredEdge = edgeForPosition(position, collisionThresholdPercent, offsetPercent);
        let edge = preferredEdge;
        // On very narrow timelines the edge safety zones can overlap. Prefer an
        // undisplaced centered label whenever its measured bounds still fit.
        const centeredBounds = transformedLabelBounds(
          position,
          'middle',
          collisionThresholdPercent,
          0,
        );
        const centered =
          collisionThresholdPercent > 50 &&
          preferredEdge !== 'middle' &&
          centeredBounds.start >= 0 &&
          centeredBounds.end <= 100;
        if (centered) edge = 'middle';
        const availableLane = laneBounds.findIndex((bounds, lane) => {
          const candidate = transformedLabelBounds(
            position,
            edge,
            collisionThresholdPercent,
            offsetPercent,
            lane,
          );
          return candidate.start >= bounds.end + 1;
        });
        const nextLane = availableLane === -1 ? laneBounds.length : availableLane;
        const isOverflow = availableLane === -1 && nextLane >= MAX_VISIBLE_LANES;
        const lane = isOverflow ? MAX_VISIBLE_LANES : nextLane;
        if (!isOverflow) {
          const bounds = transformedLabelBounds(
            position,
            edge,
            collisionThresholdPercent,
            offsetPercent,
            lane,
          );
          laneBounds[lane] = { end: bounds.end };
        }

        const isoDatetime = new Date(timestamp).toISOString();
        const state = item.state ?? 'upcoming';
        const stateLabel = stateLabelForItem(state);
        const sublabel = item.sublabel?.trim() || undefined;
        const timeLabel = sublabel ?? isoDatetime;

        const positionedItem = {
          ...item,
          accessibleLabel: `${item.label}, ${timeLabel}, ${stateLabel}`,
          centered,
          edge,
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

    const overflowGroups: PositionedEventTimelineItem[][] = [];
    for (const item of overflowItems) {
      const group = overflowGroups.at(-1);
      if (
        group === undefined ||
        item.position - group.at(-1)!.position >= collisionThresholdPercent
      ) {
        overflowGroups.push([item]);
      } else {
        group.push(item);
      }
    }

    const clusters: EventTimelineCluster[] = overflowGroups.map((overflowGroup) => {
      const chronologicalItems = overflowGroup.slice().sort((a, b) => a.timestamp - b.timestamp);
      const first = chronologicalItems[0]!;
      const last = chronologicalItems.at(-1)!;
      const startTime = first.isoDatetime;
      const endTime = last.isoDatetime;
      const countLabel = overflowGroup.length === 1 ? 'event' : 'events';
      return {
        accessibleLabel: `${overflowGroup.length} ${countLabel} between ${startTime} and ${endTime}`,
        count: overflowGroup.length,
        edge: edgeForPosition(first.position, collisionThresholdPercent),
        endTime,
        key: `cluster-${startTime}-${endTime}-${JSON.stringify(chronologicalItems.map((item) => item.id ?? item.key))}`,
        lane: MAX_VISIBLE_LANES,
        position: first.position,
        startTime,
        items: chronologicalItems,
      };
    });

    return { clusters, items: visibleItems };
  });

  const positionedItems = $derived(positionedLayout.items);
  const clusters = $derived(positionedLayout.clusters);
  const renderItems = $derived<EventTimelineRenderItem[]>(
    [
      ...positionedItems.map((item) => ({
        kind: 'item' as const,
        key: item.key,
        position: item.position,
        item,
      })),
      ...clusters.map((cluster) => ({
        kind: 'cluster' as const,
        key: cluster.key,
        position: cluster.position,
        cluster,
      })),
    ].sort((a, b) => a.position - b.position),
  );

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

  function closeCluster(restoreFocus = false): void {
    openClusterKey = null;
    if (restoreFocus) void tick().then(() => clusterTrigger?.focus());
  }

  const dismissOnOutsidePointerdown = $derived(
    createClickOutside({
      handler: closeCluster,
      enabled: () => openClusterKey !== null,
      eventType: 'pointerdown',
      ignoreRefs: [() => clusterTrigger],
    }),
  );

  $effect(() => {
    if (openClusterKey !== null && !clusters.some((cluster) => cluster.key === openClusterKey)) {
      openClusterKey = null;
      clusterTrigger = null;
    }
  });

  $effect(() => {
    if (openClusterKey === null) return;
    return pushEscapeHandler((event) => {
      event.preventDefault();
      closeCluster(true);
    });
  });

  $effect(() => {
    if (openClusterKey !== null && anchoredClusterSurface.positionReady) {
      clusterSurface?.focus();
    }
  });
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
    {@attach observeItems}
    role="list"
    aria-label={accessibleName}
    style:--_cinder-event-timeline-lane-count={laneCount}
  >
    {#each renderItems as renderItem (renderItem.key)}
      {#if renderItem.kind === 'item'}
        {@const item = renderItem.item}
        <div
          class="cinder-event-timeline__item"
          role="listitem"
          data-cinder-state={item.state}
          data-cinder-lane={item.lane}
          data-cinder-lane-parity={item.lane % 2 === 0 ? 'even' : 'odd'}
          data-cinder-edge={item.edge}
          data-cinder-centered={item.centered ? '' : undefined}
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
      {:else}
        {@const cluster = renderItem.cluster}
        {@const clusterId = `${instanceId}-cluster-${cluster.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
        <div
          class="cinder-event-timeline__cluster"
          role="listitem"
          data-cinder-edge={cluster.edge}
          data-cinder-open={openClusterKey === cluster.key ? '' : undefined}
          data-cinder-lane={cluster.lane}
          style:left="{cluster.position}%"
          style:--_cinder-event-timeline-lane={cluster.lane}
        >
          <button
            class="cinder-event-timeline__cluster-trigger"
            type="button"
            tabindex="0"
            aria-expanded={openClusterKey === cluster.key}
            aria-haspopup="dialog"
            aria-controls={clusterId}
            aria-label={cluster.accessibleLabel}
            onclick={(event) => {
              clusterTrigger = event.currentTarget as HTMLButtonElement;
              openClusterKey = openClusterKey === cluster.key ? null : cluster.key;
            }}>+{cluster.count}</button
          >
          {#if openClusterKey === cluster.key}
            <div
              class="cinder-_floating-surface cinder-event-timeline__cluster-surface"
              id={clusterId}
              role="dialog"
              aria-label={cluster.accessibleLabel}
              bind:this={clusterSurface}
              {@attach clusterPortalAttachment}
              tabindex="-1"
              data-cinder-position-ready={anchoredClusterSurface.positionReady}
              aria-hidden={anchoredClusterSurface.positionReady ? undefined : 'true'}
              style={anchoredClusterSurface.positionStyle}
              {@attach dismissOnOutsidePointerdown}
            >
              <strong>{cluster.accessibleLabel}</strong>
              <ul>
                {#each cluster.items as hiddenItem (hiddenItem.key)}
                  <li>
                    <span>{hiddenItem.label}</span>
                    <span class="cinder-event-timeline__cluster-item-details">
                      {hiddenItem.sublabel ?? hiddenItem.isoDatetime} · {hiddenItem.stateLabel}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>
