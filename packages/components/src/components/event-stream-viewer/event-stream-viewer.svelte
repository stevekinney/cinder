<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Dense append-only log of timestamped events with follow-latest scrolling, severity tones, expandable JSON details, and copy actions.
   * @tag log
   * @tag stream
   * @tag events
   * @useWhen Displaying real-time or historical operational events such as workflow steps, job logs, or webhook traces.
   * @useWhen Showing an append-only diagnostic stream with filtering, copy, and structured detail expansion.
   * @avoidWhen Showing a social activity feed or notification timeline — use feed instead.
   * @avoidWhen Rendering paginated historical records with sorting — use data-table instead.
   * @related feed, timeline, json-viewer, connection-indicator, copy-button
   */
  export type {
    EventSeverity,
    EventStreamEntry,
    EventStreamState,
    EventStreamViewerProps,
    StreamEvent,
    StreamReconnectedBoundary,
  } from './event-stream-viewer.types.ts';
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type {
    EventStreamEntry,
    EventStreamViewerProps,
    StreamEvent,
    StreamReconnectedBoundary,
  } from './event-stream-viewer.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import ConnectionIndicator from '../connection-indicator/connection-indicator.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';
  import JsonViewer from '../json-viewer/json-viewer.svelte';
  import {
    detailsIdForKey,
    reconnectedBoundaryKey,
    sequenceGapKey,
    streamEventKey,
    uniqueRenderedKey,
  } from './event-stream-viewer-keys.ts';

  type RenderedEventEntry = {
    type: 'event';
    key: string;
    detailsId: string;
    event: StreamEvent;
  };

  type RenderedReconnectedBoundary = {
    type: 'reconnected';
    key: string;
    boundary: StreamReconnectedBoundary;
    label: string;
    datetime: string | undefined;
  };

  type RenderedSequenceGap = {
    type: 'sequence-gap';
    key: string;
    expectedSequence: number;
    actualSequence: number;
    label: string;
  };

  type RenderedEntry = RenderedEventEntry | RenderedReconnectedBoundary | RenderedSequenceGap;

  // Stable per-instance id namespace for generated DOM ids (details panels).
  // Event ids are consumer-supplied and may contain spaces, punctuation, or
  // duplicates across composed viewers, so we never use them directly in an
  // `id`/`aria-controls` — we scope by this instance id plus the stable row key.
  const instanceId = $props.id();

  let {
    events,
    connectionState,
    followLatest = $bindable(true),
    truncated = false,
    loading = false,
    label = 'Event stream',
    oncopyvisible,
    onfilter,
    filterQuery = '',
    class: className,
    ...rest
  }: EventStreamViewerProps = $props();

  // IDs for expanded details panels — keyed by rendered row identity. The row
  // identity is derived from stable event fields so retained streams can drop
  // older entries without collapsing details for unchanged visible events.
  const expandedIds = new SvelteSet<string>();

  // Track the scroll container element for auto-scroll
  let scrollContainerEl = $state<HTMLElement | null>(null);

  // Guard flag: set true before programmatic scrollTop writes so handleScroll
  // ignores the intermediate scroll events they fire (especially under smooth-scroll).
  let programmaticScroll = false;

  // Live region message for copy-visible announcements
  let liveMessage = $state('');

  const isEmpty = $derived(!loading && events.length === 0);

  // Track event count and tail identity so fixed-size retained streams still
  // auto-scroll when they drop the oldest event and append a new tail event.
  const eventCount = $derived(events.length);
  const latestEvent = $derived(events.at(-1));

  const renderedEntries = $derived.by<RenderedEntry[]>(() => {
    const entries: RenderedEntry[] = [];
    const keyOccurrences = new Map<string, number>();
    let previousSequence: number | undefined;
    let previousEventId: string | undefined;
    const detectSequenceGaps = filterQuery.trim() === '';

    for (const entry of events) {
      if (isReconnectedBoundary(entry)) {
        const key = uniqueRenderedKey(reconnectedBoundaryKey(entry), keyOccurrences);
        entries.push({
          type: 'reconnected',
          key,
          boundary: entry,
          label: formatReconnectedBoundaryLabel(entry),
          datetime: boundaryDateTime(entry),
        });
        continue;
      }

      const currentSequence = entry.sequence;
      if (
        detectSequenceGaps &&
        typeof previousSequence === 'number' &&
        typeof currentSequence === 'number'
      ) {
        const expectedSequence = previousSequence + 1;
        if (currentSequence !== expectedSequence) {
          const key = uniqueRenderedKey(
            sequenceGapKey(previousEventId, entry, expectedSequence, currentSequence),
            keyOccurrences,
          );
          entries.push({
            type: 'sequence-gap',
            key,
            expectedSequence,
            actualSequence: currentSequence,
            label: formatSequenceGapLabel(expectedSequence, currentSequence),
          });
        }
      }

      if (typeof currentSequence === 'number') {
        previousSequence = currentSequence;
        previousEventId = entry.id;
      } else {
        previousSequence = undefined;
        previousEventId = undefined;
      }

      const key = uniqueRenderedKey(streamEventKey(entry), keyOccurrences);
      entries.push({
        type: 'event',
        key,
        detailsId: detailsIdForKey(instanceId, key),
        event: entry,
      });
    }

    return entries;
  });

  function toggleDetails(rowKey: string) {
    if (expandedIds.has(rowKey)) {
      expandedIds.delete(rowKey);
    } else {
      expandedIds.add(rowKey);
    }
  }

  function isReconnectedBoundary(entry: EventStreamEntry): entry is StreamReconnectedBoundary {
    return 'kind' in entry && entry.kind === 'reconnected';
  }

  function formatReconnectedBoundaryLabel(boundary: StreamReconnectedBoundary): string {
    const eventWord = boundary.replayedCount === 1 ? 'event' : 'events';
    return `Reconnected — ${boundary.replayedCount} ${eventWord} replayed`;
  }

  function formatSequenceGapLabel(expectedSequence: number, actualSequence: number): string {
    return `Sequence gap — expected ${expectedSequence}, received ${actualSequence}`;
  }

  function boundaryDateTime(boundary: StreamReconnectedBoundary): string | undefined {
    return boundary.datetime;
  }

  function formatEventAsText(event: StreamEvent): string {
    const parts: string[] = [];
    parts.push(`[${event.timestamp ?? event.datetime}]`);
    if (event.severity) parts.push(`[${event.severity.toUpperCase()}]`);
    if (event.source) parts.push(`[${event.source}]`);
    parts.push(event.summary);
    if (event.details !== undefined) {
      try {
        parts.push(JSON.stringify(event.details, null, 2));
      } catch {
        // skip unserializable details
      }
    }
    return parts.join(' ');
  }

  function formatReconnectedBoundaryAsText(boundary: StreamReconnectedBoundary): string {
    const timeLabel = boundary.timestamp ?? boundary.datetime;
    const markerText = formatReconnectedBoundaryLabel(boundary);
    return timeLabel ? `[${timeLabel}] ${markerText}` : markerText;
  }

  function formatRenderedEntryAsText(entry: RenderedEntry): string {
    if (entry.type === 'event') return formatEventAsText(entry.event);
    if (entry.type === 'reconnected') return formatReconnectedBoundaryAsText(entry.boundary);
    return entry.label;
  }

  function formatCopyVisibleAnnouncement(entryCount: number): string {
    return `${entryCount} stream ${entryCount === 1 ? 'entry' : 'entries'} sent to copy handler`;
  }

  function handleCopyVisible() {
    const text = renderedEntries.map(formatRenderedEntryAsText).join('\n');
    if (!oncopyvisible) return;
    oncopyvisible(text);
    liveMessage = formatCopyVisibleAnnouncement(renderedEntries.length);
    setTimeout(() => {
      liveMessage = '';
    }, 2000);
  }

  function handleScroll(event: Event) {
    // Ignore scroll events fired by our own programmatic scrollTop writes.
    if (programmaticScroll) return;
    const target = event.target as HTMLElement;
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 2;
    if (atBottom && !followLatest) {
      followLatest = true;
    } else if (!atBottom && followLatest) {
      followLatest = false;
    }
  }

  function scrollToBottom(el: HTMLElement) {
    programmaticScroll = true;
    el.scrollTop = el.scrollHeight;
    // Clear the guard after the browser has processed all resulting scroll events.
    requestAnimationFrame(() => {
      programmaticScroll = false;
    });
  }

  function resumeFollowing() {
    followLatest = true;
    if (scrollContainerEl) {
      scrollToBottom(scrollContainerEl);
    }
  }

  // Scroll to bottom when new events arrive and followLatest is active
  $effect(() => {
    // Access eventCount to subscribe to changes
    const count = eventCount;
    const tail = latestEvent;
    if (followLatest && count > 0 && tail && scrollContainerEl) {
      scrollToBottom(scrollContainerEl);
    }
  });
</script>

<div
  {...rest}
  class={classNames('cinder-event-stream-viewer', className)}
  data-cinder-loading={loading || undefined}
  data-cinder-empty={isEmpty || undefined}
  data-cinder-paused={!followLatest || undefined}
>
  <!-- Toolbar -->
  <div class="cinder-event-stream-viewer__toolbar" role="group" aria-label="Stream controls">
    <div class="cinder-event-stream-viewer__toolbar-start">
      {#if connectionState}
        <ConnectionIndicator state={connectionState} />
      {/if}
      {#if !followLatest}
        <button
          type="button"
          class="cinder-event-stream-viewer__resume-button"
          onclick={resumeFollowing}
        >
          Resume following
        </button>
      {/if}
    </div>
    <div class="cinder-event-stream-viewer__toolbar-end">
      {#if onfilter !== undefined}
        <input
          type="search"
          class="cinder-event-stream-viewer__filter-input"
          placeholder="Filter events…"
          aria-label="Filter events"
          value={filterQuery}
          oninput={(e) => onfilter?.((e.currentTarget as HTMLInputElement).value)}
        />
      {/if}
      {#if oncopyvisible !== undefined}
        <button
          type="button"
          class="cinder-event-stream-viewer__copy-all-button"
          onclick={handleCopyVisible}
          aria-label="Copy all visible events"
          disabled={events.length === 0}
        >
          Copy visible
        </button>
      {/if}
    </div>
  </div>

  <!-- Truncation notice -->
  {#if truncated}
    <div class="cinder-event-stream-viewer__truncation-notice" role="status" aria-live="polite">
      Stream truncated — only the most recent events are shown.
    </div>
  {/if}

  <!-- Scroll viewport: role="log" gives this element a legitimate keyboard-focus
       need (scrollable live region). svelte:element avoids the a11y_no_noninteractive_tabindex
       lint warning while retaining the exact same rendered HTML as a plain div. -->
  <svelte:element
    this={'div'}
    class="cinder-event-stream-viewer__viewport"
    role="log"
    aria-label={label}
    onscroll={handleScroll}
    bind:this={scrollContainerEl}
    tabindex={0}
  >
    {#if loading}
      <div class="cinder-event-stream-viewer__loading" role="status" aria-label="Loading events">
        <div class="cinder-event-stream-viewer__skeleton" aria-hidden="true"></div>
        <div class="cinder-event-stream-viewer__skeleton" aria-hidden="true"></div>
        <div class="cinder-event-stream-viewer__skeleton" aria-hidden="true"></div>
      </div>
    {:else if isEmpty}
      <div class="cinder-event-stream-viewer__empty" role="status">
        <p class="cinder-event-stream-viewer__empty-message">No events to display.</p>
      </div>
    {:else}
      <ol class="cinder-event-stream-viewer__list">
        {#each renderedEntries as entry (entry.key)}
          {#if entry.type === 'reconnected'}
            <li class="cinder-event-stream-viewer__boundary-marker">
              <div
                class="cinder-event-stream-viewer__marker-content"
                role="separator"
                aria-label={entry.label}
              >
                {#if entry.boundary.timestamp || entry.boundary.datetime}
                  <time
                    class="cinder-event-stream-viewer__marker-time"
                    datetime={entry.datetime}
                    title={entry.datetime}
                  >
                    {entry.boundary.timestamp ?? entry.boundary.datetime}
                  </time>
                {/if}
                <span>{entry.label}</span>
              </div>
            </li>
          {:else if entry.type === 'sequence-gap'}
            <li class="cinder-event-stream-viewer__sequence-gap-marker">
              <div
                class="cinder-event-stream-viewer__marker-content"
                role="note"
                aria-label={entry.label}
              >
                <span>{entry.label}</span>
              </div>
            </li>
          {:else}
            {@const event = entry.event}
            {@const isExpanded = expandedIds.has(entry.key)}
            {@const detailsId = entry.detailsId}
            <li
              class="cinder-event-stream-viewer__event"
              data-cinder-severity={event.severity ?? 'info'}
            >
              <div class="cinder-event-stream-viewer__event-bar" aria-hidden="true"></div>
              <div class="cinder-event-stream-viewer__event-body">
                <div class="cinder-event-stream-viewer__event-meta">
                  <time
                    class="cinder-event-stream-viewer__event-time"
                    datetime={event.datetime}
                    title={event.datetime}
                  >
                    {event.timestamp ?? event.datetime}
                  </time>
                  {#if event.severity}
                    <span
                      class="cinder-event-stream-viewer__event-severity"
                      aria-label={`Severity: ${event.severity}`}
                    >
                      {event.severity}
                    </span>
                  {/if}
                  {#if event.source}
                    <span class="cinder-event-stream-viewer__event-source">
                      {event.source}
                    </span>
                  {/if}
                </div>
                <p class="cinder-event-stream-viewer__event-summary">{event.summary}</p>
                {#if event.details !== undefined}
                  <div class="cinder-event-stream-viewer__event-details-section">
                    <button
                      type="button"
                      class="cinder-event-stream-viewer__details-toggle"
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${event.severity ? `${event.severity}: ` : ''}${event.summary}`}
                      onclick={() => toggleDetails(entry.key)}
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                    <div
                      id={detailsId}
                      class="cinder-event-stream-viewer__event-details"
                      hidden={!isExpanded}
                    >
                      {#if isExpanded}
                        <JsonViewer value={event.details} />
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
              <div class="cinder-event-stream-viewer__event-actions">
                <CopyButton
                  value={formatEventAsText(event)}
                  label={`Copy event: ${event.summary}`}
                  copiedLabel="Event copied"
                  class="cinder-event-stream-viewer__copy-event-button"
                />
              </div>
            </li>
          {/if}
        {/each}
      </ol>
    {/if}
  </svelte:element>

  <!-- Visually hidden live region for copy-visible announcements.
       Lives in the DOM always; content toggled via state (never {#if}). -->
  <span
    class="cinder-event-stream-viewer__live-region"
    role="status"
    aria-live="polite"
    aria-atomic="true">{liveMessage}</span
  >
</div>
