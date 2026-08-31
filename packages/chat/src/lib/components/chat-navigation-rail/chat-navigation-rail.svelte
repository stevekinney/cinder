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
  import { untrack } from 'svelte';
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
  let hoverMessageId = $state<string | undefined>(undefined);
  let focusMessageId = $state<string | undefined>(undefined);
  const previewMessageId = $derived(hoverMessageId ?? focusMessageId);
  let suppressNextClick = $state(false);
  let previewPosition = $state({ top: 0, left: 0 });
  let pointerType = $state<string | undefined>(undefined);
  let pointerStartX = $state(0);
  let touchStartY = $state(0);
  let pointerMoved = $state(false);
  let previewSide = $state<'right' | 'left'>('right');
  let lastScrubIndex = $state(-1);
  let previewElement = $state<HTMLElement | null>(null);

  function updatePreviewPosition(event: FocusEvent | PointerEvent, index: number): void {
    targetIndex = index;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const previewWidth = Math.min(previewElement?.offsetWidth || 288, viewportWidth - 16);
    const flip = viewportWidth - rect.right < previewWidth + 8 && rect.left >= previewWidth + 8;
    previewSide = flip ? 'left' : 'right';
    previewPosition = {
      top: rect.top + rect.height / 2,
      left: Math.max(
        8,
        Math.min(flip ? rect.left - 8 : rect.right + 8, viewportWidth - previewWidth - 8),
      ),
    };
  }

  $effect(() => {
    previewMessageId;
    const element = previewElement;
    if (!element) return;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const halfHeight = element.offsetHeight / 2;
    const currentPosition = untrack(() => previewPosition);
    const nextTop = Math.max(
      8 + halfHeight,
      Math.min(currentPosition.top, viewportHeight - 8 - halfHeight),
    );
    if (nextTop === currentPosition.top) return;
    previewPosition = {
      ...currentPosition,
      top: nextTop,
    };
  });

  function clearHoverPreview(): void {
    hoverMessageId = undefined;
  }

  function clearFocusPreview(): void {
    focusMessageId = undefined;
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
    if (index >= 0 && index !== lastScrubIndex) {
      lastScrubIndex = index;
      navigate(index);
    }
  }

  function startScrub(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || !rail) return;
    pointerId = event.pointerId;
    rail.setPointerCapture(event.pointerId);
    scrubbing = true;
    suppressNextClick = false;
    pointerType = event.pointerType;
    pointerStartX = event.clientX;
    touchStartY = event.clientY;
    pointerMoved = false;
    lastScrubIndex = -1;
  }

  function endScrub(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    finishScrub(event);
    if (!pointerMoved) {
      // A tap/click belongs to the semantic button. Let its click handler own
      // the single navigation instead of substituting pointer geometry.
      suppressNextClick = false;
      return;
    }
    // Keep the guard through the browser's synthesized click, including when
    // pointer capture retargets that click to the rail itself.
    setTimeout(() => {
      suppressNextClick = false;
    }, 0);
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
    const movement = Math.hypot(event.clientX - pointerStartX, event.clientY - touchStartY);
    if (movement <= (pointerType === 'touch' ? 8 : 2)) return;
    pointerMoved = true;
    suppressNextClick = true;
    if (rail && !rail.hasPointerCapture(event.pointerId)) rail.setPointerCapture(event.pointerId);
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
      const rows = [...observedViewport.querySelectorAll<HTMLElement>('[data-message-id]')].filter(
        (row) =>
          railMessageIds.has(row.dataset['messageId'] ?? '') && !row.closest('.chat-sub-session'),
      );
      const current = new Set(rows);
      for (const row of observed) {
        if (!current.has(row)) {
          observer.unobserve(row);
          observed.delete(row);
          const removedId = row.dataset['messageId'];
          if (removedId) visibleMessageIds.delete(removedId);
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
      if (!activeMessageId || !visibleMessageIds.has(activeMessageId)) {
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
      onpointerenter={(event) => {
        hoverMessageId = message.id;
        updatePreviewPosition(event, index);
      }}
      onpointerleave={() => clearHoverPreview()}
      onfocus={(event) => {
        focusMessageId = message.id;
        updatePreviewPosition(event, index);
      }}
      onblur={() => clearFocusPreview()}
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
      bind:this={previewElement}
      class={`chat-navigation-rail-preview chat-navigation-rail-preview-${previewSide} cinder-_floating-surface`}
      style={`--chat-navigation-preview-top: ${previewPosition.top}px; --chat-navigation-preview-left: ${previewPosition.left}px;`}
      >{preview(activePreview)}</span
    >
  {/if}
{/if}
