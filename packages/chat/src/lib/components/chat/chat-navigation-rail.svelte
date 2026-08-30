<script lang="ts">
  import { onMount } from 'svelte';
  import { getMessageText } from './utilities/utilities.ts';
  import type { ChatNavigationRailProps } from './chat-navigation-rail.types.ts';
  import { clampNavigationIndex, navigationIndexFromPointer } from './chat-navigation-rail.ts';
  let {
    messages,
    viewport = null,
    onNavigate,
    scrollToIndex,
    label = 'User messages',
    preview = getMessageText,
  }: ChatNavigationRailProps = $props();
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

  function navigate(index: number): void {
    const clamped = clampNavigationIndex(index, userMessages.length);
    const target = userMessages[clamped];
    if (clamped >= 0 && target) {
      targetIndex = clamped;
      scrollToIndex?.(target.index);
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
    rail.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function endScrub(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    scrubbing = false;
    pointerId = null;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
  }

  onMount(() => {
    if (typeof IntersectionObserver === 'undefined' || !viewport) return;
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
      },
      { root: viewport, threshold: 0.5 },
    );
    const observed = new Set<HTMLElement>();
    const reconcile = (): void => {
      const rows = viewport.querySelectorAll<HTMLElement>('[data-message-id]');
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
    mutationObserver.observe(viewport, { childList: true, subtree: true });
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
      aria-current={activeIds.has(message.id) ? 'true' : undefined}
      aria-describedby={`${message.id}-navigation-preview`}
      onclick={() => navigate(index)}
      onpointerenter={() => (targetIndex = index)}
      onfocus={() => (targetIndex = index)}
    >
      <span class="chat-navigation-rail-label">{index + 1}</span>
      <span id={`${message.id}-navigation-preview`} class="chat-navigation-rail-preview"
        >{preview(message)}</span
      >
    </button>
  {/each}
</nav>

<style>
  .chat-navigation-rail {
    display: grid;
    gap: 2px;
    inline-size: 2rem;
    align-content: center;
    touch-action: none;
  }
  .chat-navigation-rail-row {
    position: relative;
    z-index: 0;
    min-block-size: var(--cinder-touch-target-min);
    border: 0;
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-raised);
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      transform 120ms ease,
      color 120ms ease;
  }
  .chat-navigation-rail-row:hover,
  .chat-navigation-rail-row:focus-visible,
  .chat-navigation-rail-row[aria-current='true'] {
    color: var(--cinder-text-default);
    transform: scaleX(1.35);
    z-index: 1;
  }
  .chat-navigation-rail-row:has(+ .chat-navigation-rail-row[data-scrub-target]) {
    opacity: 0.7;
  }
  .chat-navigation-rail-row:has(
    + .chat-navigation-rail-row + .chat-navigation-rail-row[data-scrub-target]
  ) {
    opacity: 0.45;
  }
  .chat-navigation-rail-row[data-scrub-target] + .chat-navigation-rail-row,
  .chat-navigation-rail-row:has(+ .chat-navigation-rail-row[data-scrub-target]) {
    opacity: 0.7;
  }
  .chat-navigation-rail-row[data-scrub-target]
    + .chat-navigation-rail-row
    + .chat-navigation-rail-row,
  .chat-navigation-rail-row:has(
    + .chat-navigation-rail-row + .chat-navigation-rail-row[data-scrub-target]
  ) {
    opacity: 0.45;
  }
  .chat-navigation-rail-row:has(~ .chat-navigation-rail-row[data-scrub-target]) {
    opacity: 0.7;
  }
  .chat-navigation-rail-row:has(
    ~ .chat-navigation-rail-row:has(~ .chat-navigation-rail-row[data-scrub-target])
  ) {
    opacity: 0.45;
  }
  .chat-navigation-rail-label {
    font-size: var(--cinder-text-3xs);
  }
  .chat-navigation-rail-preview {
    position: absolute;
    inset-inline-start: calc(100% + var(--cinder-space-2));
    inset-block-start: 50%;
    translate: 0 -50%;
    inline-size: max-content;
    max-inline-size: 18rem;
    padding: var(--cinder-space-2);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-raised);
    box-shadow: var(--cinder-shadow-sm);
    opacity: 0;
    pointer-events: none;
  }
  .chat-navigation-rail-row:hover .chat-navigation-rail-preview,
  .chat-navigation-rail-row:focus-visible .chat-navigation-rail-preview {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .chat-navigation-rail-row {
      transition: none;
    }
  }
</style>
