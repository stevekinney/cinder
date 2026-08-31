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
  import {
    clampNavigationIndex,
    navigationIndexFromPointer,
    navigationScrollFromPointer,
  } from './chat-navigation-rail.ts';
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
  let rail = $state<HTMLElement | null>(null);
  let scrubbing = $state(false);
  let pointerId = $state<number | null>(null);
  let targetIndex = $state(-1);
  let activeMessageId = $state<string | undefined>(undefined);
  let previewMessageId = $state<string | undefined>(undefined);
  let suppressNextClick = $state(false);
  let previewPosition = $state({ top: 0, left: 0 });
  let pointerType = $state<string | undefined>(undefined);
  let touchStartY = $state(0);
  let touchMoved = $state(false);
  let previewSide = $state<'right' | 'left'>('right');

  function updatePreviewPosition(event: FocusEvent | PointerEvent, index: number): void {
    targetIndex = index;
    previewMessageId = userMessages[index]?.message.id;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const flip = rect.right + 300 > window.innerWidth;
    previewSide = flip ? 'left' : 'right';
    previewPosition = {
      top: rect.top + rect.height / 2,
      left: flip ? rect.left - 8 : rect.right + 8,
    };
  }

  function clearPreview(): void {
    previewMessageId = undefined;
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
    if (event.pointerType === 'touch' && rail.scrollHeight > rail.clientHeight) {
      const railBounds = rail.getBoundingClientRect();
      rail.scrollTop = navigationScrollFromPointer(
        event.clientY,
        railBounds.top,
        railBounds.height,
        rail.scrollHeight - rail.clientHeight,
      );
    }
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
    pointerType = event.pointerType;
    touchStartY = event.clientY;
    touchMoved = false;
    rail.setPointerCapture(event.pointerId);
    if (event.pointerType !== 'touch') updateFromPointer(event);
  }

  function endScrub(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    const shouldNavigateTouch = pointerType === 'touch' && !touchMoved;
    if (shouldNavigateTouch) updateFromPointer(event);
    finishScrub(event);
  }

  function cancelScrub(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    finishScrub(event);
    // A cancelled gesture does not produce a meaningful activation. Clear the
    // guard here so the next independent click is never swallowed.
    suppressNextClick = false;
  }

  function finishScrub(event: PointerEvent): void {
    scrubbing = false;
    pointerId = null;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    pointerType = undefined;
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerType === 'touch' && Math.abs(event.clientY - touchStartY) > 8) touchMoved = true;
    updateFromPointer(event);
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
      activeMessageId = undefined;
      return;
    }
    const visibleMessageIds = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset['messageId'];
          if (!id) continue;
          if (entry.isIntersecting) visibleMessageIds.add(id);
          else visibleMessageIds.delete(id);
        }
        const currentEntry = entries.find((entry) => entry.isIntersecting);
        activeMessageId = currentEntry
          ? (currentEntry.target as HTMLElement).dataset['messageId']
          : [...visibleMessageIds][0];
      },
      { root: observedViewport, threshold: 0.5 },
    );
    const observed = new Set<HTMLElement>();
    const reconcile = (): void => {
      const railMessageIds = new Set(userMessages.map(({ message }) => message.id));
      const rows = [
        ...observedViewport.querySelectorAll<HTMLElement>('[data-message-role="user"]'),
      ].filter((row) => railMessageIds.has(row.dataset['messageId'] ?? ''));
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
      for (const id of visibleMessageIds) {
        if (!railMessageIds.has(id)) visibleMessageIds.delete(id);
      }
      if (activeMessageId && !railMessageIds.has(activeMessageId)) {
        activeMessageId = [...visibleMessageIds][0];
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
  onpointermove={handlePointerMove}
  onpointerup={endScrub}
  onpointercancel={cancelScrub}
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
      onpointerleave={clearPreview}
      onfocus={(event) => updatePreviewPosition(event, index)}
      onblur={clearPreview}
    >
      <span class="chat-navigation-rail-label">{index + 1}</span>
    </button>
  {/each}
</nav>

{#each userMessages as target (target.message.id)}
  <span
    id={`${instanceId}-${target.message.id}-navigation-preview`}
    class="chat-navigation-rail-description">{preview(target.message)}</span
  >
{/each}

{#if previewMessageId}
  {@const activePreview = userMessages.find(
    ({ message }) => message.id === previewMessageId,
  )?.message}
  {#if activePreview}
    <span
      class={`chat-navigation-rail-preview chat-navigation-rail-preview-${previewSide} cinder-_floating-surface`}
      style={`--chat-navigation-preview-top: ${previewPosition.top}px; --chat-navigation-preview-left: ${previewPosition.left}px;`}
      >{preview(activePreview)}</span
    >
  {/if}
{/if}
