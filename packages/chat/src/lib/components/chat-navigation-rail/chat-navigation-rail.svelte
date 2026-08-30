<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Navigates user-authored transcript turns with keyboard and pointer scrubbing.
   * @tag chat
   * @tag navigation
   * @useWhen A long transcript needs direct navigation between user turns.
   * @avoidWhen The transcript is short enough to scan without an auxiliary navigation surface.
   * @related chat
   */
  import type { ChatNavigationRailProps } from './chat-navigation-rail.types.ts';
  export type { ChatNavigationRailProps };
</script>

<script lang="ts">
  import { getMessageText } from '../chat/utilities/utilities.ts';
  import { clampNavigationIndex, navigationIndexFromPointer } from './chat-navigation-rail.ts';
  let {
    messages,
    viewport = null,
    onNavigate,
    scrollToIndex,
    scrollToMessage,
    label = 'User messages',
    preview = getMessageText,
  }: ChatNavigationRailProps = $props();
  const instanceId = $props.id();
  const userMessages = $derived(
    messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.role === 'user'),
  );
  let activeIds = $state(new Set<string>());
  let rail = $state<HTMLElement | null>(null);
  let scrubbing = $state(false);
  let pointerId = $state<number | null>(null);
  let targetIndex = $state(-1);
  let activeMessageId = $state<string | undefined>(undefined);
  let suppressNextClick = $state(false);
  let previewPosition = $state({ top: 0, left: 0 });

  function updatePreviewPosition(event: FocusEvent | PointerEvent, index: number): void {
    targetIndex = index;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    previewPosition = { top: rect.top + rect.height / 2, left: rect.right + 8 };
  }

  function navigate(index: number): void {
    const clamped = clampNavigationIndex(index, userMessages.length);
    const target = userMessages[clamped];
    if (clamped >= 0 && target) {
      targetIndex = clamped;
      if (scrollToMessage) scrollToMessage(target.message.id);
      else scrollToIndex?.(target.index);
      onNavigate?.(target.index, target.message);
    }
  }

  function updateFromPointer(event: PointerEvent): void {
    if (!rail || pointerId !== event.pointerId) return;
    const bounds = [...rail.querySelectorAll<HTMLElement>('.chat-navigation-rail-row')].map(
      (node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      },
    );
    const index = navigationIndexFromPointer(event.clientY, bounds);
    // A pointer in a gap is not a target. In particular, do not pass -1 to
    // the clamping helper because that would intentionally select the first row.
    if (index >= 0) navigate(index);
  }

  function startScrub(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || !rail) return;
    pointerId = event.pointerId;
    scrubbing = true;
    suppressNextClick = true;
    rail.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function endScrub(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    scrubbing = false;
    pointerId = null;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    queueMicrotask(() => {
      suppressNextClick = false;
    });
  }

  function activate(index: number): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    navigate(index);
  }

  $effect(() => {
    const observedViewport = viewport;
    if (
      typeof IntersectionObserver === 'undefined' ||
      typeof MutationObserver === 'undefined' ||
      !observedViewport
    ) {
      activeIds = new Set();
      activeMessageId = undefined;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(activeIds);
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset['messageId'];
          if (!id) continue;
          if (entry.isIntersecting) next.add(id);
          else next.delete(id);
        }
        activeIds = next;
        const currentEntry = entries.find((entry) => entry.isIntersecting);
        activeMessageId = currentEntry
          ? (currentEntry.target as HTMLElement).dataset['messageId']
          : [...next][0];
      },
      { root: observedViewport, threshold: 0.5 },
    );
    const observed = new Set<HTMLElement>();
    const reconcile = (): void => {
      const rows = observedViewport.querySelectorAll<HTMLElement>('[data-message-role="user"]');
      const current = new Set(rows);
      for (const row of observed) {
        if (!current.has(row)) {
          observer.unobserve(row);
          observed.delete(row);
        }
      }
      for (const row of rows) {
        if (!observed.has(row)) {
          observer.observe(row);
          observed.add(row);
        }
      }
    };
    reconcile();
    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(observedViewport, { childList: true, subtree: true });
    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  });
</script>

<nav
  bind:this={rail}
  class="chat-navigation-rail"
  class:chat-navigation-rail-scrubbing={scrubbing}
  aria-label={label}
  onpointerdown={startScrub}
  onpointermove={updateFromPointer}
  onpointerup={endScrub}
  onpointercancel={endScrub}
>
  {#each userMessages as target, index (target.message.id)}
    {@const message = target.message}
    <button
      class="chat-navigation-rail-row"
      data-scrub-target={targetIndex === index ? '' : undefined}
      data-message-id={message.id}
      type="button"
      aria-current={activeMessageId === message.id ? 'true' : undefined}
      aria-describedby={`${instanceId}-${message.id}-navigation-preview`}
      onclick={() => activate(index)}
      onpointerenter={(event) => updatePreviewPosition(event, index)}
      onfocus={(event) => updatePreviewPosition(event, index)}
    >
      <span class="chat-navigation-rail-label">{index + 1}</span>
      <span
        id={`${instanceId}-${message.id}-navigation-preview`}
        class="chat-navigation-rail-preview"
        style={`--chat-navigation-preview-top: ${previewPosition.top}px; --chat-navigation-preview-left: ${previewPosition.left}px;`}
        >{preview(message)}</span
      >
    </button>
  {/each}
</nav>
