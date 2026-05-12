<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { SortableItemContext } from '../utilities/sortable-controller.svelte.ts';

  /** Internal props for SortableItem — not part of the public package API. */
  export type SortableItemProps<Item> = {
    item: Item;
    itemKey: string | number;
    index: number;
    itemLabel: string;
    formatHandleLabel: (itemLabel: string) => string;
    children: Snippet<[SortableItemContext]>;
    handle?: Snippet<[{ pressed: boolean; label: string }]>;
    instructionsId: string;
    total: number;
    class?: string;
  };
</script>

<script lang="ts" generics="Item">
  import { getSortableContext } from '../utilities/sortable-controller.svelte.ts';
  import { useId } from '../utilities/use-id.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    item: _item,
    itemKey,
    index,
    itemLabel,
    formatHandleLabel,
    children,
    handle,
    instructionsId,
    total,
    class: className,
  }: SortableItemProps<Item> = $props();

  const context = getSortableContext();

  // Stable internal row id for pointer midpoint calculations.
  const rowId = useId('cinder-sortable-row');

  let handleEl = $state<HTMLButtonElement | null>(null);

  // Pointer session state — instance-local, never module-scope.
  let pointerActive = $state(false);
  let pointerId = $state<number | null>(null);
  let rafHandle = $state<number | null>(null);
  let latestPointerY = $state(0);
  let listEl = $state<HTMLElement | null>(null);

  const isLifted = $derived(
    context.controller.phase === 'lifted' && context.controller.liftedKey === itemKey,
  );

  const isDropTarget = $derived(
    context.controller.phase === 'lifted' && context.controller.liftedTo === index,
  );

  const itemContext: SortableItemContext = {
    get isLifted() {
      return isLifted;
    },
    get isDropTarget() {
      return isDropTarget;
    },
    get visualIndex() {
      return index;
    },
    get total() {
      return total;
    },
  };

  const handleLabel = $derived(formatHandleLabel(itemLabel));

  function endPointerSession(reason: 'drop' | 'cancel'): void {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }

    if (pointerId !== null && handleEl?.hasPointerCapture(pointerId)) {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        // Browser may have already revoked capture (common on pointercancel).
      }
    }

    pointerActive = false;
    pointerId = null;

    if (reason === 'drop') {
      context.commitDrop(itemKey, itemLabel);
    } else {
      context.cancel(itemLabel);
    }
  }

  function scheduleAutoScroll(): void {
    if (!pointerActive) return;

    const SCROLL_ZONE = 32;
    const SCROLL_SPEED = 8;
    const viewportHeight = window.innerHeight;

    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      if (!pointerActive) return;

      if (latestPointerY < SCROLL_ZONE) {
        window.scrollBy(0, -SCROLL_SPEED);
        recomputeTarget();
        scheduleAutoScroll();
      } else if (latestPointerY > viewportHeight - SCROLL_ZONE) {
        window.scrollBy(0, SCROLL_SPEED);
        recomputeTarget();
        scheduleAutoScroll();
      }
    });
  }

  function recomputeTarget(): void {
    if (!listEl || !pointerActive) return;

    const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-sortable-row]'));
    const nonLifted = rows.filter((r) => r.dataset['rowId'] !== String(rowId));
    const midpoints = nonLifted.map((r) => {
      const rect = r.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const insertionIndex = midpoints.filter((m) => m < latestPointerY).length;
    const target = Math.max(0, Math.min(insertionIndex, total - 1));

    context.move(target, itemLabel, total);
  }

  function handlePointerDown(event: PointerEvent): void {
    // Only primary button (left click / touch).
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (!handleEl) return;

    // Find the list element for later DOM queries.
    listEl = handleEl.closest('.cinder-sortable-list') as HTMLElement | null;

    event.preventDefault();
    pointerActive = true;
    pointerId = event.pointerId;
    latestPointerY = event.clientY;

    handleEl.setPointerCapture(event.pointerId);
    context.lift(itemKey, index, itemLabel, total);
    scheduleAutoScroll();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!pointerActive) return;
    latestPointerY = event.clientY;
    recomputeTarget();
  }

  function handlePointerUp(_event: PointerEvent): void {
    if (!pointerActive) return;
    endPointerSession('drop');
  }

  function handlePointerCancel(_event: PointerEvent): void {
    if (!pointerActive) return;
    endPointerSession('cancel');
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const { key } = event;

    if (!isLifted) {
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        context.lift(itemKey, index, itemLabel, total);
      }
      return;
    }

    switch (key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (pointerActive) {
          endPointerSession('drop');
        } else {
          context.commitDrop(itemKey, itemLabel);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        context.move(context.controller.liftedTo + 1, itemLabel, total);
        break;

      case 'ArrowUp':
        event.preventDefault();
        context.move(context.controller.liftedTo - 1, itemLabel, total);
        break;

      case 'Home':
        event.preventDefault();
        context.move(0, itemLabel, total);
        break;

      case 'End':
        event.preventDefault();
        context.move(total - 1, itemLabel, total);
        break;

      case 'Escape':
        event.preventDefault();
        context.cancel(itemLabel);
        break;

      case 'Tab':
        // Cancel but allow native focus movement.
        context.cancel(itemLabel);
        break;
    }
  }

  // Cleanup on component destroy (e.g., parent removes item mid-lift).
  $effect(() => {
    return () => {
      if (!pointerActive) return;

      if (context.controller.phase === 'lifted' && context.controller.liftedKey === itemKey) {
        // Full cancel — stops auto-scroll, releases capture, announces cancelled.
        endPointerSession('cancel');
      } else {
        // Controller already auto-cancelled; only do local cleanup.
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
        if (pointerId !== null && handleEl?.hasPointerCapture(pointerId)) {
          try {
            handleEl.releasePointerCapture(pointerId);
          } catch {
            // Already revoked.
          }
        }
        pointerActive = false;
        pointerId = null;
      }
    };
  });
</script>

<li
  data-sortable-row
  data-key={itemKey}
  data-row-id={rowId}
  aria-roledescription="sortable item"
  class={cn(
    'cinder-sortable-item',
    isLifted && 'cinder-sortable-item--lifted',
    !isLifted && context.controller.phase === 'lifted' && 'cinder-sortable-item--shifting',
    className,
  )}
>
  {@render children(itemContext)}

  <button
    bind:this={handleEl}
    type="button"
    class="cinder-sortable-handle"
    aria-label={handleLabel}
    aria-pressed={isLifted}
    aria-describedby={instructionsId}
    onkeydown={handleKeyDown}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
  >
    {#if handle}
      {@render handle({ pressed: isLifted, label: handleLabel })}
    {:else}
      <!-- Default drag handle icon (grip lines) -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2 4h12v1.5H2zM2 7.25h12v1.5H2zM2 10.5h12v1.5H2z" />
      </svg>
    {/if}
  </button>
</li>
