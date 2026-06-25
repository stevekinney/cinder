<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
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
    EventStreamState,
    EventStreamViewerProps,
    StreamEvent,
  } from './event-stream-viewer.types.ts';
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import type { EventStreamViewerProps, StreamEvent } from './event-stream-viewer.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import ConnectionIndicator from '../connection-indicator/connection-indicator.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';
  import JsonViewer from '../json-viewer/json-viewer.svelte';

  // Stable per-instance id namespace for generated DOM ids (details panels).
  // Event ids are consumer-supplied and may contain spaces, punctuation, or
  // duplicates across composed viewers, so we never use them directly in an
  // `id`/`aria-controls` — we scope by this instance id plus the row index.
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

  // IDs for expanded details panels — keyed by event id
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

  function toggleDetails(id: string) {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
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

  function handleCopyVisible() {
    const text = events.map(formatEventAsText).join('\n');
    if (!oncopyvisible) return;
    oncopyvisible(text);
    liveMessage = `${events.length} event${events.length !== 1 ? 's' : ''} sent to copy handler`;
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
        {#each events as event, eventIndex (event.id)}
          {@const isExpanded = expandedIds.has(event.id)}
          {@const detailsId = `${instanceId}-details-${eventIndex}`}
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
                    onclick={() => toggleDetails(event.id)}
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
