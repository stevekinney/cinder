<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Chronological stream of feed-event entries: a plain ordered list for user-facing activity, or an operator-facing append-only log region with follow-latest scrolling.
   * @tag timeline
   * @tag activity
   * @tag log
   * @useWhen Rendering a user-facing activity stream or notification timeline.
   * @useWhen Announcing newly appended entries to assistive technology via the live prop.
   * @useWhen Displaying an operator-facing append-only stream with follow-latest scrolling — use the log arm (`kind="log"`).
   * @avoidWhen Displaying a one-off transient notice — use toast-region or banner instead.
   * @avoidWhen Displaying static temporal history or execution state — use timeline or run-step-timeline.
   * @related timeline, run-step-timeline, feed-event, feed-boundary
   */
  export type {
    FeedConnectionState,
    FeedListProps,
    FeedLogProps,
    FeedProps,
  } from './feed.types.ts';

  // See docs/decisions/chronological-display-boundaries.md for this family's boundary.
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import type { FeedProps } from './feed.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import StatusDot from '../status-dot/status-dot.svelte';

  let {
    kind = 'list',
    live = false,
    following = $bindable(true),
    loading = false,
    truncated = false,
    connectionState,
    label = 'Activity log',
    toolbar,
    class: className,
    children,
    ...rest
  }: FeedProps = $props();

  const liveRegionAttributes = $derived(
    live ? { 'aria-live': 'polite' as const, 'aria-atomic': 'false' as const } : {},
  );

  // The union rest carries element-specific attribute types per arm
  // (HTMLOListElement for the list, HTMLDivElement for the log), which the
  // un-narrowed spread cannot satisfy on either root. Runtime-safe (both are
  // plain attribute maps), so narrow per spread site rather than splitting
  // the destructure.
  const logRest = $derived(rest as Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'>);
  const listRest = $derived(rest as Omit<HTMLAttributes<HTMLOListElement>, 'children' | 'class'>);

  let viewportElement = $state<HTMLElement | null>(null);
  let listElement = $state<HTMLElement | null>(null);

  // Guard flag: set true before programmatic scrollTop writes so handleScroll
  // ignores the intermediate scroll events they fire. Cleared when the
  // viewport actually reaches the bottom — under `scroll-behavior: smooth`
  // the write animates over many frames, so a fixed one-frame window would
  // let the tail of the animation read as a user scroll-away and self-cancel
  // following. The timeout is a safety valve for an interrupted animation.
  let programmaticScroll = false;
  let programmaticScrollTimeout: ReturnType<typeof setTimeout> | undefined;

  // scrollHeight seen by the previous scroll event. When entries are trimmed
  // while the user is paused reading, the browser clamps scrollTop and fires
  // a scroll event that computes "at bottom" — that clamp must not resume
  // following (the user never scrolled down). Shrinking content marks the
  // event as clamp-suspect.
  let lastViewportScrollHeight = 0;

  function isAtBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight < 2;
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    const contentShrank =
      lastViewportScrollHeight > 0 && target.scrollHeight < lastViewportScrollHeight;
    lastViewportScrollHeight = target.scrollHeight;
    const atBottom = isAtBottom(target);
    if (programmaticScroll) {
      if (atBottom) {
        programmaticScroll = false;
        clearTimeout(programmaticScrollTimeout);
      }
      return;
    }
    if (atBottom && !following) {
      if (!contentShrank) {
        following = true;
      }
    } else if (!atBottom && following) {
      following = false;
    }
  }

  function scrollToBottom(element: HTMLElement) {
    if (isAtBottom(element)) {
      // Already pinned: the write below would be a no-op that fires NO scroll
      // event, so the guard would stay latched for the full safety timeout
      // and swallow a genuine user scroll-away inside that window. Skip the
      // latch entirely.
      return;
    }
    programmaticScroll = true;
    element.scrollTop = element.scrollHeight;
    clearTimeout(programmaticScrollTimeout);
    programmaticScrollTimeout = setTimeout(() => {
      programmaticScroll = false;
    }, 1000);
  }

  function resumeFollowing() {
    following = true;
    if (viewportElement) {
      scrollToBottom(viewportElement);
    }
    // Activating the control unmounts it ({#if !following}), which would
    // drop keyboard focus to <body>. Move focus to the tabindex="0"
    // role="log" viewport after the re-render.
    void tick().then(() => {
      viewportElement?.focus();
    });
  }

  // Follow-latest on content growth. The entries are authored children (no
  // data array to subscribe to), so observe the list's rendered size instead:
  // any appended entry grows the list, and the observer also fires once on
  // observe(), which handles the initial scroll-to-latest.
  $effect(() => {
    if (kind !== 'log') return;
    const list = listElement;
    const viewport = viewportElement;
    if (!list || !viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (following) {
        scrollToBottom(viewport);
      }
    });
    observer.observe(list);
    return () => observer.disconnect();
  });

  // Resuming via the BINDABLE (a parent "jump to latest" control setting
  // following = true) must also scroll — the observer above only fires on
  // content growth, which may never come on a quiet stream. Explicit
  // previous-value comparison, not a naive effect, so this runs only on the
  // false→true transition and never re-scrolls on unrelated re-renders.
  let wasFollowing = following;
  $effect(() => {
    const isFollowing = following;
    if (kind === 'log' && isFollowing && !wasFollowing && viewportElement) {
      scrollToBottom(viewportElement);
    }
    wasFollowing = isFollowing;
  });
</script>

{#if kind === 'log'}
  <div
    {...logRest}
    class={classNames('cinder-feed-log', className)}
    data-cinder-loading={loading ? '' : undefined}
    data-cinder-paused={!following ? '' : undefined}
  >
    {#if connectionState || toolbar}
      <div class="cinder-feed-log__toolbar" role="group" aria-label="Stream controls">
        <div class="cinder-feed-log__toolbar-start">
          {#if connectionState}
            <StatusDot {connectionState} />
          {/if}
        </div>
        {#if toolbar}
          <div class="cinder-feed-log__toolbar-end">
            {@render toolbar()}
          </div>
        {/if}
      </div>
    {/if}

    {#if truncated}
      <div class="cinder-feed-log__truncation-notice" role="status" aria-live="polite">
        Stream truncated — only the most recent entries are shown.
      </div>
    {/if}

    <div class="cinder-feed-log__scroll-region">
      <!-- Keyboard-scrollable live region: role="log" gives this element a legitimate keyboard-focus need. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="cinder-feed-log__viewport"
        role="log"
        aria-label={label}
        onscroll={handleScroll}
        bind:this={viewportElement}
        tabindex={0}
      >
        {#if loading}
          <div class="cinder-feed-log__loading" role="status" aria-label="Loading entries">
            <div class="cinder-feed-log__skeleton" aria-hidden="true"></div>
            <div class="cinder-feed-log__skeleton" aria-hidden="true"></div>
            <div class="cinder-feed-log__skeleton" aria-hidden="true"></div>
          </div>
        {:else}
          <ol class="cinder-feed" bind:this={listElement}>
            {@render children()}
          </ol>
        {/if}
      </div>

      <!-- Overlaid, not in-flow: pausing must never shift the content the
           user just scrolled to, so the resume control floats over the
           viewport instead of mounting a toolbar row. -->
      {#if !following}
        <button type="button" class="cinder-feed-log__resume-button" onclick={resumeFollowing}>
          Resume following
        </button>
      {/if}
    </div>
  </div>
{:else}
  <ol {...listRest} {...liveRegionAttributes} class={classNames('cinder-feed', className)}>
    {@render children()}
  </ol>
{/if}
