<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { SortableItemContext } from '../utilities/sortable-controller.svelte.ts';

  /** Internal props for SortableItem — not part of the public package API. */
  export type SortableItemProps<Item> = {
    /**
     * The item being rendered. Accepted for generic type symmetry with the parent's
     * snippet, but not read directly — the component uses itemKey and itemLabel instead.
     */
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
  let rowEl = $state<HTMLLIElement | null>(null);

  // Pointer session state — plain let (not $state) since these values do not
  // drive template rendering or $derived expressions; they are bookkeeping only.
  let pointerActive = false;
  let pointerId: number | null = null;
  // Two separate rAF handles so move-recompute and auto-scroll don't compete.
  let moveRafHandle: number | null = null;
  let scrollRafHandle: number | null = null;
  let latestPointerY = 0;
  let latestPointerX = 0;
  let listEl: HTMLElement | null = null;

  // Reactive state for the pointer-drag preview portal.
  // previewX / previewY drive data-preview-x / data-preview-y on the row element
  // and the --placeholder / --lifted class toggle — they must be $state.
  // isDraggingWithPointer gates both the class toggle and the data-attribute output.
  let previewX = $state(0);
  let previewY = $state(0);
  let isDraggingWithPointer = $state(false);

  // Portal dimensions are captured at lift time and written imperatively to the
  // portal's CSS custom properties inside createPreviewPortal. They never drive
  // reactive rendering, so plain let is correct here.
  let previewWidth = 0;
  let previewHeight = 0;

  // The portal element appended to document.body during a pointer drag.
  let previewPortalEl: HTMLElement | null = null;

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

  // Grab offset: distance from the pointer to the row's top-left corner at lift
  // time. Stored so subsequent moves keep the preview under the original grab
  // point rather than jumping to the row's center.
  let grabOffsetX = 0;
  let grabOffsetY = 0;

  // Create a fixed-position portal overlay that follows the pointer.
  // The overlay clones the visual appearance of the lifted row so the user
  // can see what they are dragging regardless of where the placeholder sits.
  function createPreviewPortal(pointerX: number, pointerY: number): void {
    if (typeof document === 'undefined') return;
    if (previewPortalEl) return;
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    previewWidth = rect.width;
    previewHeight = rect.height;

    // Capture the pointer's offset from the row's top-left at lift time so the
    // preview stays anchored under the grab point (not the row's center).
    grabOffsetX = pointerX - rect.left;
    grabOffsetY = pointerY - rect.top;

    const portal = document.createElement('div');
    portal.setAttribute('data-cinder-drag-preview', '');
    portal.setAttribute('aria-hidden', 'true');
    portal.setAttribute('inert', '');
    portal.className = 'cinder-sortable-drag-preview';

    // Clone the row's inner HTML into the preview so the user sees the
    // card content at the pointer location.
    const clone = rowEl.cloneNode(true) as HTMLElement;
    // Remove pointer/keyboard event attributes from the clone so the preview
    // is entirely inert. The clone is aria-hidden / inert at the portal level.
    clone.removeAttribute('data-sortable-row');
    clone.removeAttribute('data-key');
    clone.removeAttribute('data-row-id');
    // Strip all id attributes from the clone and its descendants to prevent
    // duplicate id values in the document, which would break getElementById,
    // label/for associations, and aria relationships during a drag.
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((descendant) => {
      descendant.removeAttribute('id');
    });
    portal.appendChild(clone);

    // Position the portal so its top-left aligns with the row's bounding rect
    // at the moment of lift — the transform will then track the pointer delta.
    portal.style.setProperty('--preview-width', `${previewWidth}px`);
    portal.style.setProperty('--preview-height', `${previewHeight}px`);
    portal.style.setProperty('--preview-left', `${rect.left}px`);
    portal.style.setProperty('--preview-top', `${rect.top}px`);
    portal.style.setProperty('--preview-dx', '0px');
    portal.style.setProperty('--preview-dy', '0px');

    document.body.appendChild(portal);
    previewPortalEl = portal;
    isDraggingWithPointer = true;
  }

  // Update the portal's translate offset so it follows the pointer.
  function updatePreviewPosition(pointerX: number, pointerY: number): void {
    if (!previewPortalEl || !rowEl) return;
    if (typeof document === 'undefined') return;

    const rect = rowEl.getBoundingClientRect();
    // Compute the top-left position that keeps the grab point under the pointer.
    // The portal's origin (--preview-left / --preview-top) is the row's bounding
    // rect; --preview-dx / --preview-dy shift it so the grab point aligns with
    // the current pointer. Equivalent to: newLeft = pointerX - grabOffsetX.
    const dx = pointerX - grabOffsetX - rect.left;
    const dy = pointerY - grabOffsetY - rect.top;

    previewPortalEl.style.setProperty('--preview-left', `${rect.left}px`);
    previewPortalEl.style.setProperty('--preview-top', `${rect.top}px`);
    previewPortalEl.style.setProperty('--preview-dx', `${dx}px`);
    previewPortalEl.style.setProperty('--preview-dy', `${dy}px`);

    // Keep reactive state in sync so tests can read it from data-attributes or
    // computed style rather than CSS custom properties.
    previewX = pointerX;
    previewY = pointerY;
  }

  function destroyPreviewPortal(): void {
    // Cancel any queued move-rAF before removing the portal so a pending frame
    // cannot write to a stale or removed portal element, or interfere with a
    // subsequent drag session that starts before the frame fires.
    if (moveRafHandle !== null) {
      cancelAnimationFrame(moveRafHandle);
      moveRafHandle = null;
    }
    if (previewPortalEl) {
      previewPortalEl.remove();
      previewPortalEl = null;
    }
    isDraggingWithPointer = false;
  }

  function endPointerSession(reason: 'drop' | 'cancel'): void {
    if (moveRafHandle !== null) {
      cancelAnimationFrame(moveRafHandle);
      moveRafHandle = null;
    }
    if (scrollRafHandle !== null) {
      cancelAnimationFrame(scrollRafHandle);
      scrollRafHandle = null;
    }

    if (pointerId !== null && handleEl?.hasPointerCapture(pointerId)) {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        // Browser may have already revoked capture (common on pointercancel).
      }
    }

    destroyPreviewPortal();

    pointerActive = false;
    pointerId = null;
    listEl = null;

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

    scrollRafHandle = requestAnimationFrame(() => {
      scrollRafHandle = null;
      if (!pointerActive) return;

      if (latestPointerY < SCROLL_ZONE) {
        window.scrollBy(0, -SCROLL_SPEED);
        // getBoundingClientRect forces a layout flush after scrollBy — intentional,
        // so midpoints reflect the post-scroll positions.
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
    if (!pointerActive) return;

    if (context.getPointerTarget) {
      const target = context.getPointerTarget({
        activeKey: itemKey,
        pointerX: latestPointerX,
        pointerY: latestPointerY,
        itemLabel,
      });
      if (target) context.move(target.index, itemLabel, target.total);
      return;
    }

    if (!listEl) return;

    // :scope > limits to direct children of the list — avoids picking up nested sortable rows
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>(':scope > [data-sortable-row]'));
    // data-row-id → dataset.rowId via DOM camelCase conversion
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
    // Ignore re-entry while already tracking a drag (e.g., second touch point).
    if (pointerActive) return;
    // Only primary button (left click / touch).
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (!handleEl) return;

    // Find the list element for later DOM queries.
    listEl = handleEl.closest('.cinder-sortable-list') as HTMLElement | null;

    event.preventDefault();
    pointerActive = true;
    pointerId = event.pointerId;
    latestPointerX = event.clientX;
    latestPointerY = event.clientY;

    handleEl.setPointerCapture(event.pointerId);
    context.lift(itemKey, index, itemLabel, total);

    // Create the drag preview after lift so the row is in lifted state
    // when we clone it, then position relative to the pointer.
    createPreviewPortal(event.clientX, event.clientY);
    updatePreviewPosition(event.clientX, event.clientY);
    scheduleAutoScroll();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!pointerActive) return;
    latestPointerX = event.clientX;
    latestPointerY = event.clientY;
    // Gate DOM reads to one per animation frame to avoid layout thrash on every event.
    // Uses a separate handle from scrollRafHandle so auto-scroll and move don't compete.
    if (moveRafHandle === null) {
      moveRafHandle = requestAnimationFrame(() => {
        moveRafHandle = null;
        recomputeTarget();
        updatePreviewPosition(latestPointerX, latestPointerY);
      });
    }
    // Restart auto-scroll loop if it has stopped (e.g. pointer entered edge zone
    // after starting from the middle of the page).
    if (scrollRafHandle === null) {
      scheduleAutoScroll();
    }
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
      case 'ArrowLeft':
      case 'ArrowRight':
        if (
          context.handleLiftedKeydown?.({
            event,
            itemKey,
            itemLabel,
            index,
            total,
          }) === true
        ) {
          return;
        }
        break;

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
        if (pointerActive) {
          endPointerSession('cancel');
        } else {
          context.cancel(itemLabel);
        }
        break;

      case 'Tab':
        // Cancel but allow native focus movement.
        if (pointerActive) {
          endPointerSession('cancel');
        } else {
          context.cancel(itemLabel);
        }
        break;
    }
  }

  // Observe controller state: if the controller transitions to idle while a pointer
  // session is active on this item (e.g., window Escape handler cancels from outside),
  // clean up local pointer bookkeeping without calling context.cancel() again.
  //
  // Read phase first so this effect always tracks controller.phase as a reactive
  // dependency — pointerActive is a plain `let` and does not create a dependency.
  $effect(() => {
    const phase = context.controller.phase;
    if (!pointerActive || phase !== 'idle') return;
    // Controller was cancelled externally. Release capture and stop rAFs.
    if (moveRafHandle !== null) {
      cancelAnimationFrame(moveRafHandle);
      moveRafHandle = null;
    }
    if (scrollRafHandle !== null) {
      cancelAnimationFrame(scrollRafHandle);
      scrollRafHandle = null;
    }
    if (pointerId !== null && handleEl?.hasPointerCapture(pointerId)) {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {}
    }
    destroyPreviewPortal();
    pointerActive = false;
    pointerId = null;
    listEl = null;
  });

  // Cleanup on component destroy (e.g., parent removes item mid-lift).
  $effect(() => {
    return () => {
      if (!pointerActive) return;

      if (context.controller.phase === 'lifted' && context.controller.liftedKey === itemKey) {
        // Full cancel — stops rAFs, releases capture, announces cancelled.
        endPointerSession('cancel');
      } else {
        // Controller already auto-cancelled; only do local cleanup.
        if (moveRafHandle !== null) {
          cancelAnimationFrame(moveRafHandle);
          moveRafHandle = null;
        }
        if (scrollRafHandle !== null) {
          cancelAnimationFrame(scrollRafHandle);
          scrollRafHandle = null;
        }
        if (pointerId !== null && handleEl?.hasPointerCapture(pointerId)) {
          try {
            handleEl.releasePointerCapture(pointerId);
          } catch {
            // Already revoked.
          }
        }
        destroyPreviewPortal();
        pointerActive = false;
        pointerId = null;
        listEl = null;
      }
    };
  });
</script>

<li
  bind:this={rowEl}
  data-sortable-row
  data-key={itemKey}
  data-row-id={rowId}
  data-preview-x={isDraggingWithPointer ? previewX : undefined}
  data-preview-y={isDraggingWithPointer ? previewY : undefined}
  aria-roledescription="sortable item"
  class={cn(
    'cinder-sortable-item',
    isLifted && isDraggingWithPointer && 'cinder-sortable-item--placeholder',
    isLifted && !isDraggingWithPointer && 'cinder-sortable-item--lifted',
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
